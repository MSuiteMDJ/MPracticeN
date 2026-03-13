export function buildOpenApiSpec(serverUrl = 'http://localhost:3003') {
  return {
    openapi: '3.0.3',
    info: {
      title: 'M Practice Manager API',
      version: '1.0.0',
      description: 'Backend API for M Practice Manager',
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'demo@mpractice.com' },
            password: { type: 'string', example: 'demo1234' },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['company_name', 'first_name', 'last_name', 'email', 'password'],
          properties: {
            company_name: { type: 'string', example: 'Example Practice Ltd' },
            first_name: { type: 'string', example: 'Neil' },
            last_name: { type: 'string', example: 'Jones' },
            email: { type: 'string', format: 'email', example: 'owner@example.com' },
            password: { type: 'string', minLength: 8, example: 'StrongPass123' },
          },
        },
        CompaniesHouseCredentialRequest: {
          type: 'object',
          required: ['api_key'],
          properties: {
            api_key: { type: 'string', example: 'your_companies_house_api_key' },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          summary: 'Health check',
          responses: {
            200: {
              description: 'Service health status',
            },
          },
        },
      },
      '/auth/register': {
        post: {
          summary: 'Register company and admin user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RegisterRequest' },
              },
            },
          },
          responses: {
            201: { description: 'Registered successfully' },
            400: { description: 'Validation or registration error' },
          },
        },
      },
      '/auth/login': {
        post: {
          summary: 'Login and receive JWT',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginRequest' },
              },
            },
          },
          responses: {
            200: { description: 'Login successful' },
            401: { description: 'Invalid credentials' },
          },
        },
      },
      '/auth/me': {
        get: {
          summary: 'Get current user profile',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Current authenticated user' },
            401: { description: 'Unauthorized' },
          },
        },
      },
      '/companies-house/credentials': {
        get: {
          summary: 'Get saved Companies House credential status',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Credential status' },
            401: { description: 'Unauthorized' },
          },
        },
        post: {
          summary: 'Save Companies House API key for current user',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CompaniesHouseCredentialRequest' },
              },
            },
          },
          responses: {
            200: { description: 'Credential saved' },
            400: { description: 'Missing api_key' },
            401: { description: 'Unauthorized' },
          },
        },
        delete: {
          summary: 'Delete saved Companies House API key',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Credential removed' },
            401: { description: 'Unauthorized' },
          },
        },
      },
      '/companies-house/search': {
        get: {
          summary: 'Search companies by name or number',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'q',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'Search term (minimum 2 characters)',
            },
            {
              name: 'items_per_page',
              in: 'query',
              required: false,
              schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
            },
          ],
          responses: {
            200: { description: 'Search results' },
            400: { description: 'Invalid query' },
            401: { description: 'Unauthorized' },
            503: { description: 'API key not configured' },
          },
        },
      },
      '/companies-house/company/{companyNumber}': {
        get: {
          summary: 'Get a single company profile by company number',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'companyNumber',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Companies House number, e.g. 15110513',
            },
          ],
          responses: {
            200: { description: 'Company profile' },
            401: { description: 'Unauthorized' },
            404: { description: 'Company not found' },
            503: { description: 'API key not configured' },
          },
        },
      },
      '/companies-house/company/{companyNumber}/profile': {
        get: {
          summary: 'Get full company profile (overview, officers, PSC, charges, filing history)',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'companyNumber',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'category',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Optional filing history category filter',
            },
            {
              name: 'items_per_page',
              in: 'query',
              required: false,
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            },
          ],
          responses: {
            200: { description: 'Full company profile payload' },
            401: { description: 'Unauthorized' },
            404: { description: 'Company not found' },
            503: { description: 'API key not configured' },
          },
        },
      },
      '/companies-house/company/{companyNumber}/officers': {
        get: {
          summary: 'Get company officers',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'companyNumber', in: 'path', required: true, schema: { type: 'string' } },
            {
              name: 'current_only',
              in: 'query',
              required: false,
              schema: { type: 'boolean' },
            },
          ],
          responses: {
            200: { description: 'Officers payload' },
            401: { description: 'Unauthorized' },
          },
        },
      },
      '/companies-house/company/{companyNumber}/psc': {
        get: {
          summary: 'Get persons with significant control',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'companyNumber', in: 'path', required: true, schema: { type: 'string' } },
            {
              name: 'active_only',
              in: 'query',
              required: false,
              schema: { type: 'boolean' },
            },
          ],
          responses: {
            200: { description: 'PSC payload' },
            401: { description: 'Unauthorized' },
          },
        },
      },
      '/companies-house/company/{companyNumber}/filing-history': {
        get: {
          summary: 'Get filing history',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'companyNumber', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'category', in: 'query', required: false, schema: { type: 'string' } },
            {
              name: 'items_per_page',
              in: 'query',
              required: false,
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            },
          ],
          responses: {
            200: { description: 'Filing history payload' },
            401: { description: 'Unauthorized' },
          },
        },
      },
      '/companies-house/company/{companyNumber}/charges': {
        get: {
          summary: 'Get company charges',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'companyNumber', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            200: { description: 'Charges payload' },
            401: { description: 'Unauthorized' },
          },
        },
      },
    },
  };
}
