//TODO: add reroute function

import { FastifyReply } from "fastify";

export function rerouteToMachine(reply: FastifyReply, machineId: string) {
  return reply
    .header("fly-replay", `instance=${machineId}`)
    .status(200)
    .send("Rerouting");
}
