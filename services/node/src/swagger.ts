import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CIFT API',
      version: '1.0.0',
      description: 'Context Intelligence Framework & Toolkit — 知识库管理系统 API 文档',
    },
    servers: [
      { url: '/api', description: 'API Gateway' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'JWT Token 或 API Key (ck-...)',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            code: { type: 'integer', description: '错误码' },
            message: { type: 'string', description: '错误信息' },
            details: { type: 'object', nullable: true },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
