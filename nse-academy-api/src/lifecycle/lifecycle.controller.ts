import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin/admin-auth.guard';
import { LifecycleService } from './lifecycle.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { ApplyTagDto } from './dto/apply-tag.dto';

@ApiTags('admin')
@ApiHeader({ name: 'x-admin-key', required: true, description: 'Admin API key' })
@UseGuards(AdminAuthGuard)
@Controller('admin/tags')
export class LifecycleController {
  constructor(private lifecycle: LifecycleService) {}

  @Get()
  @ApiOperation({ summary: 'List all tags with member counts' })
  list() {
    return this.lifecycle.listTags();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new tag' })
  create(@Body() dto: CreateTagDto) {
    return this.lifecycle.createTag(dto.name);
  }

  @Delete(':tagId')
  @ApiOperation({ summary: 'Delete a tag (removes it from every tagged user)' })
  remove(@Param('tagId') tagId: string) {
    return this.lifecycle.deleteTag(tagId);
  }

  @Get(':tagId/audience')
  @ApiOperation({ summary: 'Preview how many users currently have this tag' })
  audience(@Param('tagId') tagId: string) {
    return this.lifecycle.getTagAudiencePreview(tagId);
  }

  @Post(':tagId/apply')
  @ApiOperation({ summary: 'Apply a tag to one or more users' })
  apply(@Param('tagId') tagId: string, @Body() dto: ApplyTagDto) {
    return this.lifecycle.applyTag(tagId, dto.userIds);
  }

  @Post(':tagId/remove')
  @ApiOperation({ summary: 'Remove a tag from one or more users' })
  removeFromUsers(@Param('tagId') tagId: string, @Body() dto: ApplyTagDto) {
    return this.lifecycle.removeTag(tagId, dto.userIds);
  }
}
