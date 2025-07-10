import { FastifyInstance } from "fastify";
import { polarClient, getSession } from "./auth.js";
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import { object, string } from "zod/v4";
import { hasPolarAppBenefit } from "./utils.js";

export function buildCheckoutRoutes(server: FastifyInstance) {
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  server.withTypeProvider<ZodTypeProvider>().get(
    "/checkout/pro",
    {
      schema: { querystring: object({ successUrl: string() }) },
    },
    async (request, reply) => {
      const session = await getSession(request);
      if (session == null) {
        return reply.code(401).send("unauthorized");
      }
      const hasAppBenefit = await hasPolarAppBenefit(
        session.user.id,
        session.user.isAnonymous!
      );
      if (hasAppBenefit) {
        return reply.redirect(request.query.successUrl);
      }
      const { url } = await polarClient.checkouts.create({
        products: [process.env.POLAR_APP_PRO_PRODUCT_ID!],
        externalCustomerId: session.user.id,
        successUrl: request.query.successUrl,
      });
      return reply.redirect(url);
    }
  );
}
