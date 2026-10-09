import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma.service';

type ExpenseInput = { amount: number; category?: string; note?: string };

const pad = (n: number) => String(n).padStart(2, '0');

// Owner: Hub dev (P2). #58 budget
// Monthly limit: Setting key "budget.monthly".
@Controller('expenses')
@Can('budget.use')
export class ExpensesController {
  constructor(private prisma: PrismaService) {}

  // → Expense[] (newest first)
  @Get()
  list() {
    return this.prisma.expense.findMany({ orderBy: { spentAt: 'desc' } });
  }

  // ?month=2026-10 (default: this month) → BudgetSummary. Declared before :id routes.
  @Get('summary')
  async summary(@Query('month') month?: string) {
    const now = new Date();
    const [y, m] = /^\d{4}-\d{2}$/.test(month ?? '') ? month!.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
    const [expenses, limit] = await Promise.all([
      this.prisma.expense.findMany({ where: { spentAt: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } } }),
      this.prisma.setting.findUnique({ where: { key: 'budget.monthly' } }),
    ]);
    const byCategory: Record<string, number> = {};
    for (const e of expenses) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    return { month: `${y}-${pad(m)}`, total, limit: limit ? Number(limit.value) : null, byCategory };
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: ExpenseInput) {
    if (!(Number(body.amount) > 0)) throw new BadRequestException('Send an amount in pesos');
    return this.prisma.expense.create({
      data: { amount: Number(body.amount), category: body.category || 'other', note: body.note ?? '', addedById: user.id },
    });
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.expense.delete({ where: { id } });
  }
}
