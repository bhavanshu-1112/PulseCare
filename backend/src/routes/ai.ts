/**
 * AI API routes — forecasting and redistribution triggers.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { runForecasting } from '../ai/forecasting';
import { runRedistribution } from '../ai/redistribution';

export async function aiRoutes(fastify: FastifyInstance) {

  // ─── Run Forecasting Pipeline ────────────────────────────
  fastify.post('/api/ai/forecast', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await runForecasting();
      return reply.send({
        success: true,
        data: {
          total_items_analyzed: result.burnRateData.length,
          at_risk_count: result.riskAssessment.assessments.length,
          alerts_created: result.alertsCreated,
          summary: result.riskAssessment.overall_summary,
          district_summary: result.riskAssessment.district_summary,
          assessments: result.riskAssessment.assessments,
        },
      });
    } catch (err: any) {
      console.error('Forecasting error:', err);
      return reply.status(500).send({
        success: false,
        error: err.message || 'Forecasting pipeline failed',
      });
    }
  });

  // ─── GET endpoint for forecasting (convenience) ──────────
  fastify.get('/api/ai/forecast', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await runForecasting();
      return reply.send({
        success: true,
        data: {
          total_items_analyzed: result.burnRateData.length,
          at_risk_count: result.riskAssessment.assessments.length,
          alerts_created: result.alertsCreated,
          summary: result.riskAssessment.overall_summary,
          district_summary: result.riskAssessment.district_summary,
          assessments: result.riskAssessment.assessments,
        },
      });
    } catch (err: any) {
      console.error('Forecasting error:', err);
      return reply.status(500).send({
        success: false,
        error: err.message || 'Forecasting pipeline failed',
      });
    }
  });

  // ─── Run Redistribution Pipeline ─────────────────────────
  fastify.post('/api/ai/redistribute', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await runRedistribution();
      return reply.send({
        success: true,
        data: {
          deficits_found: result.deficits.length,
          surpluses_found: result.surpluses.length,
          candidates_evaluated: result.candidates.length,
          recommendations_count: result.result.recommendations.length,
          saved_count: result.savedCount,
          overall_plan: result.result.overall_plan,
          recommendations: result.result.recommendations,
        },
      });
    } catch (err: any) {
      console.error('Redistribution error:', err);
      return reply.status(500).send({
        success: false,
        error: err.message || 'Redistribution pipeline failed',
      });
    }
  });

  // ─── GET endpoint for redistribution (convenience) ───────
  fastify.get('/api/ai/redistribute', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await runRedistribution();
      return reply.send({
        success: true,
        data: {
          deficits_found: result.deficits.length,
          surpluses_found: result.surpluses.length,
          candidates_evaluated: result.candidates.length,
          recommendations_count: result.result.recommendations.length,
          saved_count: result.savedCount,
          overall_plan: result.result.overall_plan,
          recommendations: result.result.recommendations,
        },
      });
    } catch (err: any) {
      console.error('Redistribution error:', err);
      return reply.status(500).send({
        success: false,
        error: err.message || 'Redistribution pipeline failed',
      });
    }
  });

  // ─── Run Both (Full Pipeline) ────────────────────────────
  fastify.post('/api/ai/run-all', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const forecastResult = await runForecasting();
      const redistResult = await runRedistribution();

      return reply.send({
        success: true,
        data: {
          forecasting: {
            items_analyzed: forecastResult.burnRateData.length,
            alerts_created: forecastResult.alertsCreated,
            summary: forecastResult.riskAssessment.overall_summary,
          },
          redistribution: {
            recommendations: redistResult.result.recommendations.length,
            saved: redistResult.savedCount,
            plan: redistResult.result.overall_plan,
          },
        },
      });
    } catch (err: any) {
      console.error('Full pipeline error:', err);
      return reply.status(500).send({
        success: false,
        error: err.message || 'AI pipeline failed',
      });
    }
  });
}
