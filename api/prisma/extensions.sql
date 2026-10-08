-- Runs before `prisma db push` (see the db:push script). pgvector powers the RAG search.
CREATE EXTENSION IF NOT EXISTS vector;
