import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { FAKE_BUDGET, FAKE_EXPENSES } from '../fake';
import { PrismaService } from '../prisma.service';

type ExpenseInput = { amount: number; category?: string; note?: string };

// Owner: Hub dev (P2). STUB: returns fake data in the final shape (TEAM-PLAN.md 4.5). #58 budget
// Monthly limit: Setting key "budget.monthly".
@Controller('expenses')
@Can('budget.use')
export class ExpensesController {
  constructor(private prisma: PrismaService) {}

  // → Expense[] (newest first)
  @Get()
  list() {
    return FAKE_EXPENSES;
  }

  // ?month=2026-10 → BudgetSummary. Declared before :id routes.
  @Get('summary')
  summary(@Query('month') month?: string) {
    return { ...FAKE_BUDGET, month: month ?? FAKE_BUDGET.month };
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: ExpenseInput) {
    return { id: 99, amount: body.amount, category: body.category ?? 'other', note: body.note ?? '', addedById: user.id, spentAt: new Date().toISOString() };
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return { ...FAKE_EXPENSES[0], id };
  }
}
