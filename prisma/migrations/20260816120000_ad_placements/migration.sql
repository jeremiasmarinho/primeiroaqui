-- CreateEnum
CREATE TYPE "AdSlot" AS ENUM ('HERO_CAROUSEL', 'HIGHLIGHT_STRIP', 'SPONSORED_FEED');

-- CreateTable
CREATE TABLE "ad_placements" (
    "id" TEXT NOT NULL,
    "slot" "AdSlot" NOT NULL,
    "advertiserName" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_placements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_placements_slot_active_startsAt_endsAt_idx" ON "ad_placements"("slot", "active", "startsAt", "endsAt");
