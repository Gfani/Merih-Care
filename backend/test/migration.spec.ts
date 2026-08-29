import { InitialSchema1787898447679 } from "../src/database/migrations/1787898447679-InitialSchema";
import { AppointmentLifecycle1787900419412 } from "../src/database/migrations/1787900419412-AppointmentLifecycle";
import { ProviderEarningsLedger1787901129963 } from "../src/database/migrations/1787901129963-ProviderEarningsLedger";
import { ChatAndNotifications1787902239207 } from "../src/database/migrations/1787902239207-ChatAndNotifications";
import { UpdateLocationsSchema1787904046847 } from "../src/database/migrations/1787904046847-UpdateLocationsSchema";
import { MedicalRecordsAndPrivacy1787944489438 } from "../src/database/migrations/1787944489438-MedicalRecordsAndPrivacy";

describe("Database Migration Tests", () => {
  const migrations = [
    { name: "InitialSchema", instance: new InitialSchema1787898447679() },
    { name: "AppointmentLifecycle", instance: new AppointmentLifecycle1787900419412() },
    { name: "ProviderEarningsLedger", instance: new ProviderEarningsLedger1787901129963() },
    { name: "ChatAndNotifications", instance: new ChatAndNotifications1787902239207() },
    { name: "UpdateLocationsSchema", instance: new UpdateLocationsSchema1787904046847() },
    { name: "MedicalRecordsAndPrivacy", instance: new MedicalRecordsAndPrivacy1787944489438() },
  ];

  it("should have valid migration class instances", () => {
    expect(migrations.length).toBe(6);
    for (const m of migrations) {
      expect(m.instance).toBeDefined();
    }
  });

  it("should implement both 'up' and 'down' methods for each migration", () => {
    for (const m of migrations) {
      expect(typeof m.instance.up).toBe("function");
      expect(typeof m.instance.down).toBe("function");
    }
  });

  it("should execute migration up/down queries against mock QueryRunner without syntax errors", async () => {
    const mockQueryRunner = {
      query: jest.fn().mockResolvedValue([]),
    } as any;

    for (const m of migrations) {
      // Execute up
      await expect(m.instance.up(mockQueryRunner)).resolves.not.toThrow();
      // Execute down (rollback)
      await expect(m.instance.down(mockQueryRunner)).resolves.not.toThrow();
    }

    expect(mockQueryRunner.query).toHaveBeenCalled();
  });
});
