import { Entity, type EntityOptions } from "./entity";
import { parseExpression, type EvalContext } from "./expr";
import { Modifier } from "./mod";

const ETYPE = "stat";

export interface StatisticOptions extends EntityOptions {
  base?: string;
}

export class Statistic extends Entity {
  entityType(): string {
    return ETYPE;
  }

  base: string;

  constructor(options: StatisticOptions = {}) {
    super(options);
    this.base = options.base ?? "0";
  }

  toJSON(): object {
    return {
      ...super.toJSON(),
      base: this.base,
    };
  }

  allMods(ctx: EvalContext): Modifier[] {
    const result: Modifier[] = [];
    if (ctx.rootEntity instanceof Modifier && ctx.rootEntity.stat === this.id) {
      result.push(ctx.rootEntity);
    }
    for (const child of ctx.rootEntity.children) {
      this.allMods({
        ...ctx,
        rootEntity: child,
      }).forEach((mod) => result.push(mod));
    }
    return result;
  }

  applicableMods(ctx: EvalContext): Modifier[] {
    return this.allMods(ctx).filter((m) => m.isApplicable(ctx));
  }

  eval(ctx: EvalContext): number {
    return this.applicableMods(ctx).reduce(
      (n, m) => m.apply(n, ctx),
      parseExpression(this.base).eval({
        ...ctx,
        currentEntity: this,
      }),
    );
  }
}

Entity.FROM_JSON_REGISTRY[ETYPE] = (json: any) => {
  return new Statistic(json);
};
