import { Injectable } from "@nestjs/common";
import { FieldExtractor } from "../../application/ports/index.js";

@Injectable()
export class FieldExtractorAdapter implements FieldExtractor {}
