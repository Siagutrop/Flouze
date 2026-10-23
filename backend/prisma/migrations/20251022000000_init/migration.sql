-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CASH', 'CREDIT_CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EXPENSE', 'INCOME', 'ACCOUNT_TRANSFER');

-- CreateEnum
CREATE TYPE "RecurringKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "DebtDirection" AS ENUM ('OWED_TO_ME', 'I_OWE');

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultCurrencyCode" TEXT NOT NULL DEFAULT 'EUR',
    "budgetGenerationDay" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "householdId" TEXT NOT NULL,
    "webauthnChallenge" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebAuthnCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebAuthnCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "minorUnits" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL DEFAULT 'CHECKING',
    "currencyCode" TEXT NOT NULL,
    "initialBalance" BIGINT NOT NULL DEFAULT 0,
    "cover" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Envelope" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "ownerId" TEXT,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "cover" TEXT,
    "alertThreshold" BIGINT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Envelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "toAccountId" TEXT,
    "envelopeId" TEXT,
    "type" "TransactionType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "date" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringTemplate" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "ownerId" TEXT,
    "kind" "RecurringKind" NOT NULL,
    "accountId" TEXT NOT NULL,
    "envelopeId" TEXT,
    "amount" BIGINT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "isSubscription" BOOLEAN NOT NULL DEFAULT false,
    "frequency" "Frequency" NOT NULL DEFAULT 'MONTHLY',
    "dayOfMonth" INTEGER,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credit" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "accountId" TEXT,
    "principal" BIGINT NOT NULL,
    "annualRatePercent" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "monthlyPayment" BIGINT NOT NULL,
    "cover" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsGoal" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "cover" TEXT,
    "targetAmount" BIGINT NOT NULL,
    "deadline" DATE,
    "accountId" TEXT,
    "envelopeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetPeriod" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "ownerId" TEXT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "BudgetPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "allocated" BIGINT NOT NULL DEFAULT 0,
    "carryoverIn" BIGINT NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvelopeTransfer" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "fromEnvelopeId" TEXT NOT NULL,
    "toEnvelopeId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvelopeTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keysJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TxTemplate" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "ownerId" TEXT,
    "label" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL DEFAULT 'EXPENSE',
    "amount" BIGINT NOT NULL DEFAULT 0,
    "accountId" TEXT,
    "envelopeId" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TxTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "ownerId" TEXT,
    "person" TEXT NOT NULL,
    "direction" "DebtDirection" NOT NULL,
    "amount" BIGINT NOT NULL,
    "paid" BIGINT NOT NULL DEFAULT 0,
    "note" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WebAuthnCredential_credentialId_key" ON "WebAuthnCredential"("credentialId");

-- CreateIndex
CREATE INDEX "WebAuthnCredential_userId_idx" ON "WebAuthnCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Account_householdId_ownerId_idx" ON "Account"("householdId", "ownerId");

-- CreateIndex
CREATE INDEX "Category_householdId_ownerId_idx" ON "Category"("householdId", "ownerId");

-- CreateIndex
CREATE INDEX "Envelope_householdId_ownerId_idx" ON "Envelope"("householdId", "ownerId");

-- CreateIndex
CREATE INDEX "Transaction_householdId_date_idx" ON "Transaction"("householdId", "date");

-- CreateIndex
CREATE INDEX "Transaction_envelopeId_date_idx" ON "Transaction"("envelopeId", "date");

-- CreateIndex
CREATE INDEX "Transaction_accountId_date_idx" ON "Transaction"("accountId", "date");

-- CreateIndex
CREATE INDEX "RecurringTemplate_householdId_ownerId_idx" ON "RecurringTemplate"("householdId", "ownerId");

-- CreateIndex
CREATE INDEX "BudgetPeriod_householdId_ownerId_year_month_idx" ON "BudgetPeriod"("householdId", "ownerId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_periodId_envelopeId_key" ON "BudgetLine"("periodId", "envelopeId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "UserAchievement_userId_idx" ON "UserAchievement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_code_key" ON "UserAchievement"("userId", "code");

-- CreateIndex
CREATE INDEX "AuditLog_householdId_createdAt_idx" ON "AuditLog"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX "TxTemplate_householdId_ownerId_idx" ON "TxTemplate"("householdId", "ownerId");

-- CreateIndex
CREATE INDEX "Debt_householdId_ownerId_idx" ON "Debt"("householdId", "ownerId");

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_defaultCurrencyCode_fkey" FOREIGN KEY ("defaultCurrencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebAuthnCredential" ADD CONSTRAINT "WebAuthnCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Envelope" ADD CONSTRAINT "Envelope_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Envelope" ADD CONSTRAINT "Envelope_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Envelope" ADD CONSTRAINT "Envelope_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTemplate" ADD CONSTRAINT "RecurringTemplate_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTemplate" ADD CONSTRAINT "RecurringTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTemplate" ADD CONSTRAINT "RecurringTemplate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTemplate" ADD CONSTRAINT "RecurringTemplate_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credit" ADD CONSTRAINT "Credit_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsGoal" ADD CONSTRAINT "SavingsGoal_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPeriod" ADD CONSTRAINT "BudgetPeriod_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetPeriod" ADD CONSTRAINT "BudgetPeriod_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "BudgetPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvelopeTransfer" ADD CONSTRAINT "EnvelopeTransfer_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvelopeTransfer" ADD CONSTRAINT "EnvelopeTransfer_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "BudgetPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvelopeTransfer" ADD CONSTRAINT "EnvelopeTransfer_fromEnvelopeId_fkey" FOREIGN KEY ("fromEnvelopeId") REFERENCES "Envelope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvelopeTransfer" ADD CONSTRAINT "EnvelopeTransfer_toEnvelopeId_fkey" FOREIGN KEY ("toEnvelopeId") REFERENCES "Envelope"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TxTemplate" ADD CONSTRAINT "TxTemplate_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TxTemplate" ADD CONSTRAINT "TxTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TxTemplate" ADD CONSTRAINT "TxTemplate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TxTemplate" ADD CONSTRAINT "TxTemplate_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "Envelope"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

