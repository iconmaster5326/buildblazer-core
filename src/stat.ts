import * as entity from "./entity";
import * as expr from "./expr";
import * as mod from "./mod";

const ETYPE = "stat";

export interface StatisticOptions extends entity.EntityOptions {
  base?: string;
}

export class Statistic extends entity.Entity {
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
    }
  }

  allMods(ctx: expr.EvalContext): mod.Modifier[] {
    const result: mod.Modifier[] = [];
    if (ctx.rootEntity instanceof mod.Modifier && ctx.rootEntity.stat === this.id) {
      result.push(ctx.rootEntity);
    }
    for (const child of ctx.rootEntity.children) {
      this.allMods({
        ...ctx,
        rootEntity: child,
      }).forEach(mod => result.push(mod));
    }
    return result;
  }

  applicableMods(ctx: expr.EvalContext): mod.Modifier[] {
    return this.allMods(ctx).filter(m => m.isApplicable(ctx));
  }

  eval(ctx: expr.EvalContext): number {
    return this.applicableMods(ctx).reduce((n, m) => m.apply(n, ctx), expr.parseExpression(this.base).eval({
      ...ctx,
      currentEntity: this,
    }));
  }
}

entity.Entity.FROM_JSON_REGISTRY[ETYPE] = (json: any) => {
  return new Statistic(json);
};
