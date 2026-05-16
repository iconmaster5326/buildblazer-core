import * as ohm from "ohm-js";

import { Entity } from "./entity";

export interface EvalContext {
  rootEntity: Entity;
  currentEntity: Entity;
  uuidMap: Record<string, Entity>;
}

export abstract class Expression {
  abstract eval(ctx: EvalContext): number;
}

export class ExprNumber extends Expression {
  value: number;

  constructor(value: number) {
    super();
    this.value = value;
  }

  eval(ctx: EvalContext): number {
    return this.value;
  }
}

export enum ExprBinOp {
  ADD,
  SUB,
  MUL,
  DIV,
  EXP,
  AND,
  OR,
  EQ,
  NEQ,
  LT,
  LE,
  GT,
  GE,
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
      default:
        throw new Error(`Unknown operator '${this.op}'!`);
    }
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
    = ExprMath3 ("^"|"**") ExprDice -- Exp
    | ExprDice
  
  ExprDice
    = ExprDice ("#" ident)+ -- Tag
    | ExprDice caseInsensitive<"d"> ExprConst DicePostfix? -- Dice
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
    = "(" Expr ")" -- Parens
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

exprSemantics.addOperation("parse", {
  ExprConst_Number(value): Expression {
    return new ExprNumber(Number.parseFloat(value.sourceString));
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
});

export function parseExpression(expr: string | ohm.MatchResult): Expression {
  return exprSemantics(
    typeof expr === "string" ? exprGrammar.match(expr) : expr,
  ).parse();
}
