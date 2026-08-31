import * as fs from "fs";
import * as path from "path";

describe("Deployment & Environment Checklist Tests", () => {
  const rootDir = path.resolve(__dirname, "../../");

  describe("Docker Compose Configurations", () => {
    it("should have production docker-compose.yml with network isolation", () => {
      const prodPath = path.join(rootDir, "docker-compose.yml");
      expect(fs.existsSync(prodPath)).toBe(true);
      const content = fs.readFileSync(prodPath, "utf-8");
      expect(content).toContain("backend-net");
      expect(content).toContain("frontend-net");
      expect(content).toContain("postgres:");
      expect(content).toContain("redis:");
    });

    it("should have dev docker-compose.dev.yml with hot reload mapping", () => {
      const devPath = path.join(rootDir, "docker-compose.dev.yml");
      expect(fs.existsSync(devPath)).toBe(true);
      const content = fs.readFileSync(devPath, "utf-8");
      expect(content).toContain("postgres-dev");
      expect(content).toContain("redis-dev");
    });

    it("should have staging docker-compose.staging.yml", () => {
      const stagingPath = path.join(rootDir, "docker-compose.staging.yml");
      expect(fs.existsSync(stagingPath)).toBe(true);
      const content = fs.readFileSync(stagingPath, "utf-8");
      expect(content).toContain("postgres-staging");
      expect(content).toContain("redis-staging");
    });
  });

  describe("CI/CD Pipeline & Operations Documentation", () => {
    it("should have GitHub Actions CI/CD workflow defined", () => {
      const cicdPath = path.join(rootDir, ".github/workflows/ci-cd.yml");
      expect(fs.existsSync(cicdPath)).toBe(true);
      const content = fs.readFileSync(cicdPath, "utf-8");
      expect(content).toContain("backend-test");
      expect(content).toContain("admin-web-test");
      expect(content).toContain("mobile-test");
    });

    it("should have production deployment and rollback guides", () => {
      const opsDir = path.join(rootDir, "backend/docs/ops");
      expect(fs.existsSync(path.join(opsDir, "production-deployment-guide.md"))).toBe(true);
      expect(fs.existsSync(path.join(opsDir, "rollback-strategy.md"))).toBe(true);
      expect(fs.existsSync(path.join(opsDir, "infrastructure-monitoring.md"))).toBe(true);
    });
  });
});
