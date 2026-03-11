# MindVault Console — Monorepo

Control Plane для MindVault SaaS: личный кабинет (web) + API + shared.

## Структура

```
apps/
  api/        — NestJS (REST API, BullMQ, Prisma)
  web/        — Next.js 14 (SSR, App Router)
packages/
  shared/     — Zod схемы, TypeScript типы
docker/
  docker-compose.yml
```

## Запуск локально

```bash
cp docker/.env.example docker/.env
# Отредактируй docker/.env
cd docker && docker compose up --build
```

Web: http://localhost:3000
API: http://localhost:3001
Swagger: http://localhost:3001/api/docs

## Прод

Деплой через Dokploy на console.mvault.ru.
