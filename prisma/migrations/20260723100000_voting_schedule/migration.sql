-- CreateEnum
CREATE TYPE "ScheduleMode" AS ENUM ('unlimited', 'timed');

-- AlterTable
ALTER TABLE "Election" ADD COLUMN "scheduleMode" "ScheduleMode" NOT NULL DEFAULT 'unlimited';
ALTER TABLE "Election" ADD COLUMN "votingStartsAt" TIMESTAMP(3);
ALTER TABLE "Election" ADD COLUMN "votingEndsAt" TIMESTAMP(3);
