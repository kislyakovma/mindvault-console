import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  app.enableCors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000', credentials: true })

  const config = new DocumentBuilder()
    .setTitle('MindVault API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build()
  const doc = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, doc)

  await app.listen(process.env.PORT || 3001)
  console.log(`API running on port ${process.env.PORT || 3001}`)
}
bootstrap()
