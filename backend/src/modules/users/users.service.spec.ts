import { Test, TestingModule } from "@nestjs/testing";
import { UsersService } from "./users.service";
import { getRepositoryToken } from "@nestjs/typeorm";
import { UserEntity } from "../../database/entities/user.entity";

describe("UsersService Unit Tests", () => {
  let service: UsersService;

  const mockUserRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUserRepo,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it("should get all patient users", async () => {
    mockUserRepo.find.mockResolvedValue([
      { id: "u-1", name: "Patient One", role: "patient" },
      { id: "u-2", name: "Patient Two", role: "patient" },
    ]);

    const users = await service.getAllUsers();
    expect(users.length).toBe(2);
    expect(mockUserRepo.find).toHaveBeenCalledWith({ where: { role: "patient" } });
  });

  it("should toggle user suspension status from active to suspended", async () => {
    const user = { id: "u-1", status: "active" };
    mockUserRepo.findOne.mockResolvedValue(user);
    mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

    const updated = await service.toggleUserSuspension("u-1");
    expect(updated.status).toBe("suspended");
  });

  it("should toggle user suspension status from suspended to active", async () => {
    const user = { id: "u-1", status: "suspended" };
    mockUserRepo.findOne.mockResolvedValue(user);
    mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

    const updated = await service.toggleUserSuspension("u-1");
    expect(updated.status).toBe("active");
  });

  it("should return null if user does not exist", async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    const updated = await service.toggleUserSuspension("non-existent");
    expect(updated).toBeNull();
  });
});
