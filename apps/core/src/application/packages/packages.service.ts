import { Injectable } from "@nestjs/common";

import { PipelineService } from "../pipeline/pipeline.service.js";
import {
  PackagesRepository,
  type CreatePackageInput,
  type PackageDetail,
  type PackageSummary,
} from "../ports/packages.repository.js";

/**
 * Package use cases (ADR-0004: application layer). Creating a package persists
 * it and kicks off the verification pipeline (PRD §4.1); the pipeline runs in
 * the background so the request returns as soon as the package exists.
 */
@Injectable()
export class PackagesService {
  constructor(
    private readonly repo: PackagesRepository,
    private readonly pipeline: PipelineService,
  ) {}

  async create(input: CreatePackageInput): Promise<PackageSummary> {
    const pkg = await this.repo.create(input);
    this.pipeline.enqueue(pkg.id);
    return pkg;
  }

  list(): Promise<PackageSummary[]> {
    return this.repo.list();
  }

  getById(id: string): Promise<PackageDetail | null> {
    return this.repo.findDetail(id);
  }
}
