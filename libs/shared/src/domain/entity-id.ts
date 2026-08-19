export abstract class EntityId {
  protected constructor(public readonly value: string) {}

  equals(other: this): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}
