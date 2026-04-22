import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { CorporateService } from './corporate.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('corporate')
@UseGuards(JwtAuthGuard)
export class CorporateController {
  constructor(private corporateService: CorporateService) {}

  @Post('register')
  async register(@Request() req: any, @Body() body: { name: string; type: string; email: string }) {
    return this.corporateService.createOrganization(req.user.id, body);
  }

  @Post('license/pay')
  async licensePay(@Request() req: any, @Body() body: { plan: string }) {
    const membership = await this.corporateService.getUserOrg(req.user.id);
    if (!membership) throw new ForbiddenException('No organization found');
    return this.corporateService.initializeLicense(membership.orgId, body.plan);
  }

  @Post('license/verify')
  async licenseVerify(@Request() req: any, @Body() body: { reference: string }) {
    const membership = await this.corporateService.getUserOrg(req.user.id);
    if (!membership) throw new ForbiddenException('No organization found');
    return this.corporateService.verifyAndActivateLicense(membership.orgId, body.reference);
  }

  @Post('invite')
  async invite(@Request() req: any, @Body() body: { email: string }) {
    const membership = await this.corporateService.getUserOrg(req.user.id);
    if (!membership || membership.role !== 'admin') {
      throw new ForbiddenException('Only org admins can invite members');
    }
    return this.corporateService.inviteMember(membership.orgId, body.email);
  }

  @Post('invite/accept')
  async acceptInvite(@Request() req: any, @Body() body: { token: string }) {
    return this.corporateService.acceptInvite(body.token, req.user.id);
  }

  @Get('dashboard')
  async dashboard(@Request() req: any) {
    const membership = await this.corporateService.getUserOrg(req.user.id);
    if (!membership) throw new ForbiddenException('No organization found');
    return this.corporateService.getOrgDashboard(membership.orgId);
  }

  @Delete('members/:memberId')
  async removeMember(@Request() req: any, @Param('memberId') memberId: string) {
    const membership = await this.corporateService.getUserOrg(req.user.id);
    if (!membership || membership.role !== 'admin') {
      throw new ForbiddenException('Only org admins can remove members');
    }
    return this.corporateService.removeMember(membership.orgId, memberId);
  }

  @Get('me')
  async me(@Request() req: any) {
    return this.corporateService.getUserOrg(req.user.id);
  }
}
