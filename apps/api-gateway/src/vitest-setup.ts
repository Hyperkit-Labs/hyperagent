import { resetGatewayEnvForTests } from "@hyperagent/config";
import { beforeEach } from "vitest";

beforeEach(() => {
  resetGatewayEnvForTests();
});
