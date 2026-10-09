import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { notify, speak } from '../family';
import { PrismaService } from '../prisma.service';
import { placeAt } from './geo';

type Fix = { lat: number; lng: number; accuracy?: number };
type PlaceInput = { name: string; lat: number; lng: number; radiusM?: number };

const validFix = (b: { lat: number; lng: number }) =>
  Number.isFinite(b?.lat) && Number.isFinite(b?.lng) && Math.abs(b.lat) <= 90 && Math.abs(b.lng) <= 180;

// Owner: Brain dev. #51 "Where is Ana?" + #52 safe zones (TEAM-PLAN.md section 9).
// Phones send GPS from the web Map page (over the Cloudflare tunnel: browsers only share GPS on HTTPS).
// Locations stay on the hub; only parents (location.read) can see them.
@Controller()
export class LocationController {
  constructor(private prisma: PrismaService) {}

  // The phone's GPS, every ~20 s. Entering a place → presence:arrived notice to the parents + the hub says it.
  // → { place: string | null }
  @Can('location.share')
  @Post('location')
  async update(@CurrentUser() user: AuthUser, @Body() body: Fix) {
    if (!validFix(body)) throw new BadRequestException('Send { lat, lng }');
    const [places, before] = await Promise.all([
      this.prisma.place.findMany(),
      this.prisma.location.findUnique({ where: { userId: user.id } }),
    ]);
    const here = placeAt(body, places);
    const moved = !before || before.placeId !== (here?.id ?? null);
    const fix = { lat: body.lat, lng: body.lng, accuracy: body.accuracy ?? null };
    await this.prisma.location.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...fix, placeId: here?.id ?? null },
      update: { ...fix, ...(moved ? { placeId: here?.id ?? null, since: new Date() } : {}) },
    });

    if (moved && before) {
      const left = places.find((p) => p.id === before.placeId);
      const text = here ? `${user.name} arrived at ${here.name}` : left ? `${user.name} left ${left.name}` : null;
      if (text) {
        const parents = await this.prisma.user.findMany({ where: { role: { name: 'parent' } } });
        for (const p of parents) {
          if (p.id !== user.id) await notify(this.prisma, p.id, here ? 'presence:arrived' : 'presence:left', text, { userId: user.id, placeId: here?.id ?? left?.id });
        }
        if (here) speak(/^home$/i.test(here.name) ? `Welcome home, ${user.name}!` : text);
      }
    }
    return { place: here?.name ?? null };
  }

  // Everyone's last location for the map. → [{ userId, name, lat, lng, accuracy, place, since, updatedAt }]
  @Can('location.read')
  @Get('location')
  async list() {
    const [locations, users, places] = await Promise.all([
      this.prisma.location.findMany(),
      this.prisma.user.findMany({ select: { id: true, name: true } }),
      this.prisma.place.findMany(),
    ]);
    return locations.map((l) => ({
      ...l,
      name: users.find((u) => u.id === l.userId)?.name ?? '?',
      place: places.find((p) => p.id === l.placeId)?.name ?? null,
    }));
  }

  @Can('location.read')
  @Get('places')
  places() {
    return this.prisma.place.findMany({ orderBy: { name: 'asc' } });
  }

  // "Add place here": the parent's current GPS + a name.
  @Can('location.read')
  @Post('places')
  addPlace(@Body() body: PlaceInput) {
    if (!body.name?.trim() || !validFix(body)) throw new BadRequestException('Send { name, lat, lng }');
    return this.prisma.place.create({
      data: { name: body.name.trim(), lat: body.lat, lng: body.lng, radiusM: Math.min(Math.max(body.radiusM ?? 150, 30), 2000) },
    });
  }

  @Can('location.read')
  @Delete('places/:id')
  removePlace(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.place.delete({ where: { id } });
  }
}
