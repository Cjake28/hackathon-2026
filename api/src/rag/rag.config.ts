// Tune the RAG (document Q&A) here.
export const RAG = {
  chunkSize: 1200, // characters per chunk
  chunkOverlap: 200, // characters shared by neighbouring chunks, so an answer isn't cut in half
  topK: 6, // chunks given to the AI per question
  minScore: 0, // 0–1 similarity; raise it (e.g. 0.5) to drop weak matches
  maxFileMb: 10,
  fileTypes: /\.(pdf|txt|md|markdown)$/i,
  system: [
    'Answer the question using only the numbered sources.',
    'Cite the sources you used like [1] or [2][3] right after the sentence they support.',
    "If the sources don't contain the answer, say you couldn't find it in the documents.",
    'Reply in the language of the question.',
  ].join(' '),
};
