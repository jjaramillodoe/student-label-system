'use client';

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

export default function ApiDocsSwagger() {
  return (
    <div className="api-docs-swagger min-h-screen bg-background">
      <SwaggerUI
        url="/api/openapi.json"
        docExpansion="list"
        defaultModelsExpandDepth={1}
        tryItOutEnabled
        persistAuthorization
        displayRequestDuration
      />
      <style jsx global>{`
        .api-docs-swagger .swagger-ui .topbar {
          display: none;
        }
        .api-docs-swagger .swagger-ui .information-container {
          margin: 1rem 0;
        }
      `}</style>
    </div>
  );
}
