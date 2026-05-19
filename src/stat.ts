import type { Buildblazer } from "./buildblazer";
import { Entity, type EntityOptions } from "./entity";
import { Expression, parseExpression, type EvalContext } from "./expr";
import { Modifier } from "./mod";
import type { SystemEntity } from "./system";

/** Options for the constructor of {@link Statistic}. */
export interface StatisticOptions extends EntityOptions {
  /** The base value of this statistic, as an expression string. Default is 0. */
  base?: string;
}

/** A statistic is a numeric value belinging to a build (and not a sheet) that can be modified by various sources. */
export class Statistic extends Entity {
  entityType(): string {
    return Statistic.ETYPE.id;
  }

  /** The base value of this statistic, as an expression string. The empty string is treated as 0. */
  base: string;

  constructor(options: StatisticOptions = {}) {
    super(options);
    this.base = options.base ?? "0";
  }

  toJSON(): any {
    return {
      ...super.toJSON(),
      base: this.base,
    };
  }

  /**
   * Return all the modifiers that are possibly applicable to this statistic, regardless of condition.
   * @see {@link applicableMods}
   */
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

  /**
   * Return all the modifiers that are currently applicable to this statistic.
   * @see {@link allMods}
   */
  applicableMods(ctx: EvalContext): Modifier[] {
    return this.allMods(ctx).filter((m) => m.isApplicable(ctx));
  }

  /** Return the value of this statistic, taking into account all currently applicable modifiers. */
  valueExpr(ctx: EvalContext): Expression {
    return this.applicableMods(ctx)
      .reduce((n, m) => m.apply(n, ctx), parseExpression(this.base))
      .simplify({
        ...ctx,
        currentEntity: this,
      });
  }

  /** Evaluate this statistics's value, taking into account all currently applicable modifiers. */
  eval(ctx: EvalContext): number {
    return this.valueExpr(ctx).eval(ctx);
  }

  /** Type information for this entity. Don't use this directly; {@link Buildblazer} already sets this up for you. */
  static ETYPE: SystemEntity = {
    id: "stat",
    deserializer: Statistic.fromJSON,
  };

  /** Deserialize a statistic from JSON. */
  static fromJSON(bb: Buildblazer, json: any): Statistic {
    return new Statistic({
      ...Entity.optionsFromJSON(bb, json),
      base: json.base,
    });
  }
}
