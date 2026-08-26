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
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { LicensePayDto } from './dto/license-pay.dto';
import { LicenseVerifyDto } from './dto/license-verify.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';

@Controller('corporate')
@UseGuards(JwtAuthGuard)
export class CorporateController {
  constructor(private corporateService: CorporateService) {}

  @Post('register')
  async register(@Request() req: any, @Body() body: RegisterOrganizationDto) {
    return this.corporateService.createOrganization(req.user.id, body);
  }

  @Post('license/pay')
  async licensePay(@Request() req: any, @Body() body: LicensePayDto) {
    const membership = await this.corporateService.getUserOrg(req.user.id);
    if (!membership) throw new ForbiddenException('No organization found');
    return this.corporateService.initializeLicense(membership.orgId, body.plan);
  }

  @Post('license/verify')
  async licenseVerify(@Request() req: any, @Body() body: LicenseVerifyDto) {
    const membership = await this.corporateService.getUserOrg(req.user.id);
    if (!membership) throw new ForbiddenException('No organization found');
    return this.corporateService.verifyAndActivateLicense(membership.orgId, body.reference);
  }

  @Post('invite')
  async invite(@Request() req: any, @Body() body: InviteMemberDto) {
    const membership = await this.corporateService.getUserOrg(req.user.id);
    if (!membership || membership.role !== 'admin') {
      throw new ForbiddenException('Only org admins can invite members');
    }
    return this.corporateService.inviteMember(membership.orgId, body.email);
  }

  @Post('invite/accept')
  async acceptInvite(@Request() req: any, @Body() body: AcceptInviteDto) {
    return this.corporateService.acceptInvite(body.token, req.user.id);
  }

  @Post('members/:memberId/resend-invite')
  async resendInvite(@Request() req: any, @Param('memberId') memberId: string) {
    const membership = await this.corporateService.getUserOrg(req.user.id);
    if (!membership || membership.role !== 'admin') {
      throw new ForbiddenException('Only org admins can resend invites');
    }
    return this.corporateService.resendInvite(membership.orgId, memberId);
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
