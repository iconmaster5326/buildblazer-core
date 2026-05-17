import * as ohm from "ohm-js";

import { Entity } from "./entity";

export interface EvalContext {
  rootEntity: Entity;
  currentEntity: Entity;
  uuidMap: Record<string, Entity>;
}

export abstract class Expression {
  abstract eval(ctx: EvalContext): number;
  abstract simplify(ctx: EvalContext): Expression;
  abstract constant(ctx: EvalContext): boolean;
  abstract toString(): string;
  abstract precedence(): number;

  toStringWithParens(outerPrecedence: number): string {
    const value = this.toString();
    if (outerPrecedence <= this.precedence()) {
      return value;
    } else {
      return `(${value})`;
    }
  }
}

export class ExprNumber extends Expression {
  value: number;

  constructor(value: number) {
    super();
    this.value = value;
  }

  eval(): number {
    return this.value;
  }

  simplify(): Expression {
    return this;
  }

  constant(): boolean {
    return true;
  }

  toString(): string {
    return `${this.value}`;
  }

  precedence(): number {
    return 10;
  }
}

export enum ExprBinOp {
  ADD = "+",
  SUB = "-",
  MUL = "*",
  DIV = "/",
  EXP = "^",
  AND = "and",
  OR = "or",
  EQ = "=",
  NEQ = "!=",
  LT = "<",
  LE = "<=",
  GT = ">",
  GE = ">=",
}

export class ExprBin extends Expression {
  lhs: Expression;
  op: ExprBinOp;
  rhs: Expression;

  constructor(lhs: Expression, op: ExprBinOp, rhs: Expression) {
    super();
    this.lhs = lhs;
    this.op = op;
    this.rhs = rhs;
  }

  eval(ctx: EvalContext): number {
    switch (this.op) {
      case ExprBinOp.ADD:
        return this.lhs.eval(ctx) + this.rhs.eval(ctx);
      case ExprBinOp.SUB:
        return this.lhs.eval(ctx) - this.rhs.eval(ctx);
      case ExprBinOp.MUL:
        return this.lhs.eval(ctx) * this.rhs.eval(ctx);
      case ExprBinOp.DIV:
        return this.lhs.eval(ctx) / this.rhs.eval(ctx);
      case ExprBinOp.EXP:
        return this.lhs.eval(ctx) ** this.rhs.eval(ctx);
      case ExprBinOp.AND:
        return this.lhs.eval(ctx) && this.rhs.eval(ctx);
      case ExprBinOp.OR:
        return this.lhs.eval(ctx) || this.rhs.eval(ctx);
      case ExprBinOp.EQ:
        return this.lhs.eval(ctx) == this.rhs.eval(ctx) ? 1 : 0;
      case ExprBinOp.NEQ:
        return this.lhs.eval(ctx) != this.rhs.eval(ctx) ? 1 : 0;
      case ExprBinOp.LT:
        return this.lhs.eval(ctx) < this.rhs.eval(ctx) ? 1 : 0;
      case ExprBinOp.LE:
        return this.lhs.eval(ctx) <= this.rhs.eval(ctx) ? 1 : 0;
      case ExprBinOp.GT:
        return this.lhs.eval(ctx) > this.rhs.eval(ctx) ? 1 : 0;
      case ExprBinOp.GE:
        return this.lhs.eval(ctx) >= this.rhs.eval(ctx) ? 1 : 0;
    }
  }

  communicative(): boolean {
    switch (this.op) {
      case ExprBinOp.ADD:
      case ExprBinOp.MUL:
      case ExprBinOp.AND:
      case ExprBinOp.OR:
        return true;
      default:
        return false;
    }
  }

  reductionSeed(): number {
    switch (this.op) {
      case ExprBinOp.ADD:
      case ExprBinOp.SUB:
      case ExprBinOp.OR:
        return 0;
      case ExprBinOp.MUL:
      case ExprBinOp.AND:
        return 1;
      default:
        throw new Error(`unexpected reduction op '${this.op}'!`);
    }
  }

  reductionOperation(acc: number, n: number): number {
    switch (this.op) {
      case ExprBinOp.ADD:
      case ExprBinOp.SUB:
        return acc + n;
      case ExprBinOp.MUL:
        return acc * n;
      case ExprBinOp.AND:
        return acc && n ? 1 : 0;
      case ExprBinOp.OR:
        return acc || n ? 1 : 0;
      default:
        throw new Error(`unexpected reduction op '${this.op}'!`);
    }
  }

  negativeOp(): ExprBinOp {
    switch (this.op) {
      case ExprBinOp.ADD:
        return ExprBinOp.SUB;
      case ExprBinOp.SUB:
        return ExprBinOp.ADD;
      default:
        return this.op;
    }
  }

  simplify(ctx: EvalContext): Expression {
    const lhsConst = this.lhs.constant(ctx);
    const rhsConst = this.rhs.constant(ctx);
    const rhsIsNumber = this.rhs instanceof ExprNumber;
    const rhsValue = rhsIsNumber ? (this.rhs as ExprNumber).value : Number.NaN;

    if (lhsConst && rhsConst) {
      return new ExprNumber(this.eval(ctx));
    } else if (lhsConst && this.communicative()) {
      return new ExprBin(
        this.rhs.simplify(ctx),
        this.op,
        new ExprNumber(this.lhs.eval(ctx)),
      ).simplify(ctx);
    } else if (lhsConst && !(this.lhs instanceof ExprNumber)) {
      return new ExprBin(
        new ExprNumber(this.lhs.eval(ctx)),
        this.op,
        this.rhs.simplify(ctx),
      ).simplify(ctx);
    } else if (rhsConst && !rhsIsNumber) {
      return new ExprBin(
        this.lhs.simplify(ctx),
        this.op,
        new ExprNumber(this.rhs.eval(ctx)),
      ).simplify(ctx);
    } else if (this.negativeOp() !== this.op && rhsIsNumber && rhsValue < 0) {
      return new ExprBin(
        this.lhs.simplify(ctx),
        this.negativeOp(),
        new ExprNumber(-rhsValue),
      ).simplify(ctx);
    } else if (
      (this.op === ExprBinOp.ADD || this.op === ExprBinOp.SUB) &&
      rhsIsNumber &&
      rhsValue === 0
    ) {
      return this.lhs.simplify(ctx);
    } else if (
      (this.op === ExprBinOp.MUL ||
        this.op === ExprBinOp.DIV ||
        this.op === ExprBinOp.EXP) &&
      rhsIsNumber &&
      rhsValue === 1
    ) {
      return this.lhs.simplify(ctx);
    } else if (this.op === ExprBinOp.MUL && rhsIsNumber && rhsValue === 0) {
      return this.rhs;
    } else if (this.communicative() || this.op === ExprBinOp.SUB) {
      const nonConstTerms: Expression[] = [];
      let constTotal = this.reductionSeed();
      let toCheckForTerms: Expression = this;

      while (toCheckForTerms instanceof ExprBin) {
        if (toCheckForTerms.op === this.op) {
          if (toCheckForTerms.rhs.constant(ctx)) {
            constTotal = this.reductionOperation(
              constTotal,
              toCheckForTerms.rhs.eval(ctx),
            );
          } else {
            nonConstTerms.push(toCheckForTerms.rhs.simplify(ctx));
          }
          toCheckForTerms = toCheckForTerms.lhs.simplify(ctx);
        } else if (toCheckForTerms.op === this.negativeOp()) {
          if (toCheckForTerms.rhs.constant(ctx)) {
            constTotal = this.reductionOperation(
              constTotal,
              -toCheckForTerms.rhs.eval(ctx),
            );
          } else {
            nonConstTerms.push(new ExprNeg(toCheckForTerms.rhs.simplify(ctx)));
          }
          toCheckForTerms = toCheckForTerms.lhs.simplify(ctx);
        } else {
          break;
        }
      }
      nonConstTerms.push(toCheckForTerms);

      let result: Expression =
        nonConstTerms.pop() ?? new ExprNumber(Number.NaN);

      for (const term of nonConstTerms) {
        if (this.op !== this.negativeOp() && term instanceof ExprNeg) {
          result = new ExprBin(result, this.negativeOp(), term.rhs);
        } else {
          result = new ExprBin(result, this.op, term);
        }
      }
      if (constTotal !== this.reductionSeed()) {
        if (this.op !== this.negativeOp() && constTotal < 0) {
          result = new ExprBin(
            result,
            this.negativeOp(),
            new ExprNumber(-constTotal),
          );
        } else {
          result = new ExprBin(result, this.op, new ExprNumber(constTotal));
        }
      }
      return result;
    } else {
      return new ExprBin(
        this.lhs.simplify(ctx),
        this.op,
        this.rhs.simplify(ctx),
      );
    }
  }

  constant(ctx: EvalContext): boolean {
    return this.lhs.constant(ctx) && this.rhs.constant(ctx);
  }

  toString(): string {
    const prec = this.precedence();
    return `${this.lhs.toStringWithParens(prec)} ${this.op} ${this.rhs.toStringWithParens(prec)}`;
  }

  precedence(): number {
    switch (this.op) {
      case ExprBinOp.ADD:
      case ExprBinOp.SUB:
        return 5;
      case ExprBinOp.MUL:
      case ExprBinOp.DIV:
        return 6;
      case ExprBinOp.EXP:
        return 7;
      case ExprBinOp.AND:
        return 2;
      case ExprBinOp.OR:
        return 1;
      case ExprBinOp.EQ:
      case ExprBinOp.NEQ:
        return 3;
      case ExprBinOp.LT:
      case ExprBinOp.LE:
      case ExprBinOp.GT:
      case ExprBinOp.GE:
        return 4;
    }
  }
}

export class ExprNeg extends Expression {
  rhs: Expression;

  constructor(rhs: Expression) {
    super();
    this.rhs = rhs;
  }

  eval(ctx: EvalContext): number {
    return -this.rhs.eval(ctx);
  }

  simplify(ctx: EvalContext): Expression {
    if (this.rhs.constant(ctx)) {
      return new ExprNumber(this.eval(ctx));
    }
    if (this.rhs instanceof ExprNeg) {
      return this.rhs.rhs.simplify(ctx);
    }
    return this;
  }

  constant(ctx: EvalContext): boolean {
    return this.rhs.constant(ctx);
  }

  toString(): string {
    return `-${this.rhs.toStringWithParens(this.precedence())}`;
  }

  precedence(): number {
    return 8;
  }
}

export class ExprDice extends Expression {
  nDice: Expression;
  nFaces: Expression;
  keepHighest: Expression | undefined;
  keepLowest: Expression | undefined;
  dropHighest: Expression | undefined;
  dropLowest: Expression | undefined;
  explode: boolean;

  constructor(
    nDice: Expression,
    nFaces: Expression,
    options: {
      keepHighest?: Expression;
      keepLowest?: Expression;
      dropHighest?: Expression;
      dropLowest?: Expression;
      explode?: boolean;
    } = {},
  ) {
    super();
    this.nDice = nDice;
    this.nFaces = nFaces;
    this.keepHighest = options.keepHighest;
    this.keepLowest = options.keepLowest;
    this.dropHighest = options.dropHighest;
    this.dropLowest = options.dropLowest;
    this.explode = options.explode ?? false;
  }

  eval(ctx: EvalContext): number {
    const nDice = this.nDice.eval(ctx);
    const nFaces = this.nFaces.eval(ctx);

    let total = 0;
    for (let i = 0; i < nDice; i++) {
      total += Math.floor(Math.random() * nFaces);
    }
    return total;
  }

  simplify(ctx: EvalContext): Expression {
    if (this.nDice.constant(ctx) && this.nDice.eval(ctx) <= 0) {
      return new ExprNumber(0);
    }

    let nFaces: number;
    if (this.nFaces.constant(ctx) && (nFaces = this.nFaces.eval(ctx)) <= 1) {
      return new ExprNumber(nFaces);
    }

    return this;
  }

  constant(ctx: EvalContext): boolean {
    if (this.nDice.constant(ctx) && this.nDice.eval(ctx) <= 0) {
      return true;
    }
    if (this.nFaces.constant(ctx) && this.nFaces.eval(ctx) <= 1) {
      return true;
    }
    return false;
  }

  toString(): string {
    const prec = this.precedence();
    return `${this.nDice.toStringWithParens(prec)}d${this.nFaces.toStringWithParens(prec)}`;
  }

  precedence(): number {
    return 9;
  }
}

export const exprGrammar = ohm.grammar(String.raw`
Expression {
  Expr
    = ExprIf

  ExprIf
    = caseInsensitive<"if"> Expr caseInsensitive<"then"> Expr caseInsensitive<"else"> Expr -- If
    | ExprOr
  
  ExprOr
    = ExprOr (caseInsensitive<"or">|"&&") ExprAnd -- Or
    | ExprAnd

  ExprAnd
    = ExprAnd (caseInsensitive<"and">|"||") ExprEq -- And
    | ExprEq
  
  ExprEq
    = ExprEq ("="|"==") ExprRel -- Eq
    | ExprEq "!=" ExprRel -- Neq
    | ExprRel
  
  ExprRel
    = ExprRel "<" ExprMath1 -- Lt
    | ExprRel "<=" ExprMath1 -- Le
    | ExprRel ">" ExprMath1 -- Gt
    | ExprRel ">=" ExprMath1 -- Ge
    | ExprMath1

  ExprMath1
    = ExprMath1 "+" ExprMath2 -- Add
    | ExprMath1 "-" ExprMath2 -- Sub
    | ExprMath2

  ExprMath2
    = ExprMath2 "*" ExprMath3 -- Mul
    | ExprMath2 "/" ExprMath3 -- Div
    | ExprMath3

  ExprMath3
    = ExprMath3 ("^"|"**") ExprTag -- Exp
    | ExprTag
  
  ExprTag
    = ExprTag ("#" ident)+ -- Tag
    | ExprUnary

  ExprUnary
    = "+" ExprUnary -- Pos
    | "-" ExprUnary -- Neg
    | ExprLiteral
  
  ExprLiteral
    = Var "(" (Expr ("," Expr)* ","?)? ")" -- Call
    | Var -- Var
    | ExprConst
  
  ExprConst
    = ExprConst caseInsensitive<"d"> ExprConst DicePostfix? -- Dice
    | "(" Expr ")" -- Parens
    | number -- Number
  
  Var = ident ("." ident)*
  
  DicePostfix
    = caseInsensitive<"kh"> ExprConst -- KeepHighest
    | caseInsensitive<"kl"> ExprConst -- KeepLowest
    | caseInsensitive<"dh"> ExprConst -- DropHighest
    | caseInsensitive<"dl"> ExprConst -- DropLowest
    | caseInsensitive<"ex"> -- Explode

  ident
    = letter alnum*

  number
    = (digit* ".")? digit+
}
`);
export const exprSemantics = exprGrammar.createSemantics();

function parse(expr: ohm.Node): Expression {
  return expr.parse();
}

/* eslint-disable @typescript-eslint/no-unused-vars */
exprSemantics.addOperation("parse", {
  ExprConst_Number(value): Expression {
    return new ExprNumber(Number.parseFloat(value.sourceString));
  },
  ExprConst_Parens(_1, value, _2): Expression {
    return parse(value);
  },
  ExprConst_Dice(nDice, _, nFaces, options): Expression {
    // TODO: roll options
    return new ExprDice(parse(nDice), parse(nFaces));
  },
  ExprAnd_And(lhs, _, rhs): Expression {
    return new ExprBin(parse(lhs), ExprBinOp.AND, parse(rhs));
  },
  ExprOr_Or(lhs, _, rhs): Expression {
    return new ExprBin(parse(lhs), ExprBinOp.OR, parse(rhs));
  },
  ExprEq_Eq(lhs, _, rhs): Expression {
    return new ExprBin(parse(lhs), ExprBinOp.EQ, parse(rhs));
  },
  ExprEq_Neq(lhs, _, rhs): Expression {
    return new ExprBin(parse(lhs), ExprBinOp.NEQ, parse(rhs));
  },
  ExprRel_Gt(lhs, _, rhs): Expression {
    return new ExprBin(parse(lhs), ExprBinOp.GT, parse(rhs));
  },
  ExprRel_Ge(lhs, _, rhs): Expression {
    return new ExprBin(parse(lhs), ExprBinOp.GE, parse(rhs));
  },
  ExprRel_Lt(lhs, _, rhs): Expression {
    return new ExprBin(parse(lhs), ExprBinOp.LT, parse(rhs));
  },
  ExprRel_Le(lhs, _, rhs): Expression {
    return new ExprBin(parse(lhs), ExprBinOp.LE, parse(rhs));
  },
  ExprMath1_Add(lhs, _, rhs): Expression {
    return new ExprBin(parse(lhs), ExprBinOp.ADD, parse(rhs));
  },
  ExprMath1_Sub(lhs, _, rhs): Expression {
    return new ExprBin(parse(lhs), ExprBinOp.SUB, parse(rhs));
  },
  ExprMath2_Mul(lhs, _, rhs): Expression {
    return new ExprBin(parse(lhs), ExprBinOp.MUL, parse(rhs));
  },
  ExprMath2_Div(lhs, _, rhs): Expression {
    return new ExprBin(parse(lhs), ExprBinOp.DIV, parse(rhs));
  },
  ExprMath3_Exp(lhs, _, rhs): Expression {
    return new ExprBin(parse(lhs), ExprBinOp.EXP, parse(rhs));
  },
  ExprUnary_Pos(_, rhs): Expression {
    return parse(rhs);
  },
  ExprUnary_Neg(_, rhs): Expression {
    return new ExprNeg(parse(rhs));
  },
});
/* eslint-enable */

export function parseExpression(expr: string | ohm.MatchResult): Expression {
  return exprSemantics(
    typeof expr === "string" ? exprGrammar.match(expr) : expr,
  ).parse();
}
