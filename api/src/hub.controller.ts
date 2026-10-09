import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/auth.decorators';
import { lanAddresses } from './network';

// The hub's local network addresses, so the web app can show a "scan to open on your phone" QR code.
@Controller('hub')
export class HubController {
  @Public()
  @Get()
  info() {
    return { ips: lanAddresses() };
  }
}
