-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "fk_est" TEXT,
ADD COLUMN     "fk_reservacli" TEXT;

-- CreateTable
CREATE TABLE "NotaFeedback" (
    "id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "nota" INTEGER NOT NULL,
    "comentario" TEXT NOT NULL DEFAULT '',
    "fk_feedback" TEXT NOT NULL,

    CONSTRAINT "NotaFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotaFeedback_fk_feedback_idx" ON "NotaFeedback"("fk_feedback");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFeedback_fk_feedback_categoria_key" ON "NotaFeedback"("fk_feedback", "categoria");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_fk_reservacli_key" ON "Feedback"("fk_reservacli");

-- CreateIndex
CREATE INDEX "Feedback_fk_est_idx" ON "Feedback"("fk_est");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_fk_est_fkey" FOREIGN KEY ("fk_est") REFERENCES "Estacionamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_fk_reservacli_fkey" FOREIGN KEY ("fk_reservacli") REFERENCES "ReservaCli"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFeedback" ADD CONSTRAINT "NotaFeedback_fk_feedback_fkey" FOREIGN KEY ("fk_feedback") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;
