import { Injectable, BadRequestException, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ProviderEntity } from "../../database/entities/provider.entity";
import { AppointmentEntity } from "../../database/entities/appointment.entity";
import { TimeOffEntity } from "../../database/entities/emergency-relation.entity";

@Injectable()
export class AvailabilityService {
  constructor(
    @Optional()
    @InjectRepository(ProviderEntity)
    private readonly providerRepo?: Repository<ProviderEntity>,
    @Optional()
    @InjectRepository(AppointmentEntity)
    private readonly appointmentRepo?: Repository<AppointmentEntity>,
    @Optional()
    @InjectRepository(TimeOffEntity)
    private readonly timeOffRepo?: Repository<TimeOffEntity>,
  ) {}

  async getAvailability(providerId: string, targetDate?: string): Promise<any> {
    const dateStr = targetDate || new Date().toISOString().split("T")[0];

    // 1. Verify provider status if repository is injected
    let providerName = "Provider";
    let customToggles: Record<string, boolean> = {};
    if (this.providerRepo) {
      const provider = await this.providerRepo.findOne({
        where: [{ id: providerId }, { userId: providerId }],
      });
      if (provider) {
        if (provider.status === "suspended") {
          throw new BadRequestException("Provider is currently inactive or suspended");
        }
        providerName = provider.name;
        customToggles = provider.customAvailability || {};
      }
    }

    // 2. Standard working hour slots (9:00 AM to 5:00 PM)
    const baseSlots = [
      { id: "slot-0900", time: "09:00 - 10:00" },
      { id: "slot-1000", time: "10:00 - 11:00" },
      { id: "slot-1100", time: "11:00 - 12:00" },
      { id: "slot-1400", time: "14:00 - 15:00" },
      { id: "slot-1500", time: "15:00 - 16:00" },
      { id: "slot-1600", time: "16:00 - 17:00" },
    ];

    // 3. Check blocked periods / time off
    let isTimeOff = false;
    if (this.timeOffRepo) {
      const timeOffs = await this.timeOffRepo.find({ where: { providerId } });
      isTimeOff = timeOffs.some((to) => dateStr >= to.startDate && dateStr <= to.endDate);
    }

    if (isTimeOff) {
      return {
        providerId,
        providerName,
        date: dateStr,
        status: "on_leave",
        timeSlots: baseSlots.map((s) => ({
          ...s,
          date: dateStr,
          available: false,
          reason: "Provider on scheduled leave",
        })),
      };
    }

    // 4. Query booked appointments for conflict checks
    const bookedTimes = new Set<string>();
    if (this.appointmentRepo) {
      const appointments = await this.appointmentRepo.find({
        where: { providerId, date: dateStr },
      });
      for (const apt of appointments) {
        if (apt.status !== "cancelled" && apt.status !== "rejected") {
          bookedTimes.add(apt.time);
        }
      }
    }

    // 5. Map slots with dynamic availability and provider toggles
    const timeSlots = baseSlots.map((slot) => {
      const isBooked = bookedTimes.has(slot.time) || bookedTimes.has(slot.time.split(" - ")[0]);
      // Check custom toggle for this date and slot ID / time
      const keyById = `${dateStr}_${slot.id}`;
      const keyByTime = `${dateStr}_${slot.time}`;
      let isAvailable = !isBooked;

      if (customToggles[keyById] !== undefined) {
        isAvailable = customToggles[keyById] && !isBooked;
      } else if (customToggles[keyByTime] !== undefined) {
        isAvailable = customToggles[keyByTime] && !isBooked;
      }

      return {
        id: slot.id,
        date: dateStr,
        time: slot.time,
        available: isAvailable,
      };
    });

    return {
      providerId,
      providerName,
      date: dateStr,
      timeSlots,
    };
  }

  async updateSlotAvailability(
    providerId: string,
    slotData: { date?: string; slotId?: string; time?: string; available: boolean }
  ): Promise<any> {
    const targetDate = slotData.date || new Date().toISOString().split("T")[0];
    const slotKey = slotData.slotId || slotData.time;
    if (!slotKey) {
      throw new BadRequestException("slotId or time must be specified");
    }

    if (this.providerRepo) {
      const provider = await this.providerRepo.findOne({
        where: [{ id: providerId }, { userId: providerId }],
      });
      if (provider) {
        const current = provider.customAvailability || {};
        const key = `${targetDate}_${slotKey}`;
        current[key] = slotData.available;
        if (slotData.time && slotData.slotId) {
          current[`${targetDate}_${slotData.time}`] = slotData.available;
          current[`${targetDate}_${slotData.slotId}`] = slotData.available;
        }
        provider.customAvailability = current;
        await this.providerRepo.save(provider);
      }
    }

    return {
      success: true,
      providerId,
      date: targetDate,
      slot: slotKey,
      available: slotData.available,
    };
  }
}
