import * as ohm from "ohm-js";

import { Entity } from "./entity";

/** A context in which expressions are evaluated. */
export interface EvalContext {
  rootEntity: Entity;
  currentEntity: Entity;
  uuidMap: Record<string, Entity>;
}

/** A parsed expression. These can do math, roll dice, and refer to the values of statistics/toggles/etc. */
export abstract class Expression {
  /** Evaluate the expression. */
  abstract eval(ctx: EvalContext): number;
  /** Turn the expression into the nicest possible human-readable form. Replace variables whose values are known, coalesce terms, and so on. */
  abstract simplify(ctx: EvalContext): Expression;
  /** Is this expression able to be evaluated right now without randomness or variance? This may involve resolving variables, but not roll dice. */
  abstract constant(ctx: EvalContext): boolean;
  /**
   * Turn the expression back into a string that can be re-parsed.
   * @see {@link toStringWithParens}
   */
  abstract toString(): string;
  /** The operator precedence of this expression, for {@link toString} purposes. */
  abstract precedence(): number;

  /** Any tags applied to this expression. Tags can be used by some systems for display, category, damage type, etc. purposes. */
  tags: string[] = [];

  /** Add tags to this expression in-place. */
  addTags(...tags: string[]): this {
    this.tags.splice(this.tags.length, 0, ...tags);
    return this;
  }

  /**
   * Call {@link toString}, but surround it with parentheses if needed to not break operator precedence.
   * @param outerPrecedence The precedence of the expression calling this method.
   */
  toStringWithParens(outerPrecedence: number): string {
    const value = this.toString();
    if (outerPrecedence <= this.precedence()) {
      return value;
    } else {
      return `(${value})`;
    }
  }
}

/** A numeric literal. */
export class ExprNumber extends Expression {
  /** The value of this literal. */
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

/** A binary operator type. */
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

/** A binary operator application. */
export class ExprBin extends Expression {
  /** The left-hand side operand. */
  lhs: Expression;
  /** The operator. */
  op: ExprBinOp;
  /** The right-hand side operand. */
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

  /** Is this operator communicative? That is, can we freely rearrange operands in a chain of these? */
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

  /** When we sum, product, etc. a list of terms with this operator, what is the seed value? 0 or 1. */
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

  /** Execute the operator on two literal operands. */
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

  /** What's the opposite operator for add/subtract operations? Otherwise, returns the operator unchanged. */
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

/** A negation operation. */
export class ExprNeg extends Expression {
  /** The right-hand side operand. */
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

/** Options for the constructor to {@link ExprDice}. */
export interface ExprDiceOptions {
  /** If present, how many dice to actually keep from the dice rolled, preferring the highest dice. */
  keepHighest?: Expression;
  /** If present, how many dice to actually keep from the dice rolled, preferring the lowest dice. */
  keepLowest?: Expression;
  /** If present, how many dice to remove from the dice rolled, preferring the highest dice. */
  dropHighest?: Expression;
  /** If present, how many dice to remove from the dice rolled, preferring the lowest dice. */
  dropLowest?: Expression;
  /** If true, indicates that a roll of the maximum face should add another die to roll. */
  explode?: boolean;
}

/** A roll of some dice. */
export class ExprDice extends Expression {
  /** The number of dice to roll. */
  nDice: Expression;
  /** The number of faces on the dice. */
  nFaces: Expression;
  /** If present, how many dice to actually keep from the dice rolled, preferring the highest dice. */
  keepHighest: Expression | undefined;
  /** If present, how many dice to actually keep from the dice rolled, preferring the lowest dice. */
  keepLowest: Expression | undefined;
  /** If present, how many dice to remove from the dice rolled, preferring the highest dice. */
  dropHighest: Expression | undefined;
  /** If present, how many dice to remove from the dice rolled, preferring the lowest dice. */
  dropLowest: Expression | undefined;
  /** If true, indicates that a roll of the maximum face should add another die to roll. */
  explode: boolean;

  constructor(
    nDice: Expression,
    nFaces: Expression,
    options: ExprDiceOptions = {},
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
    let sb = `${this.nDice.toStringWithParens(prec)}d${this.nFaces.toStringWithParens(prec)}`;
    if (this.keepHighest) {
      sb += `kh${this.keepHighest.toStringWithParens(this.precedence())}`;
    }
    if (this.keepLowest) {
      sb += `kl${this.keepLowest.toStringWithParens(this.precedence())}`;
    }
    if (this.dropHighest) {
      sb += `dh${this.dropHighest.toStringWithParens(this.precedence())}`;
    }
    if (this.dropLowest) {
      sb += `dl${this.dropLowest.toStringWithParens(this.precedence())}`;
    }
    if (this.explode) {
      sb += `ex`;
    }
    return sb;
  }

  precedence(): number {
    return 10;
  }
}

/** A conditional epxression. */
export class ExprIf extends Expression {
  /** The condition. 0 is false, all else is true. */
  cond: Expression;
  /** What to return if {@link cond} is true. */
  ifTrue: Expression;
  /** What to return if {@link cond} is false. */
  ifFalse: Expression;

  constructor(cond: Expression, ifTrue: Expression, ifFalse: Expression) {
    super();
    this.cond = cond;
    this.ifTrue = ifTrue;
    this.ifFalse = ifFalse;
  }

  eval(ctx: EvalContext): number {
    if (this.cond.eval(ctx)) {
      return this.ifTrue.eval(ctx);
    } else {
      return this.ifFalse.eval(ctx);
    }
  }

  simplify(ctx: EvalContext): Expression {
    if (this.cond.constant(ctx)) {
      if (this.cond.eval(ctx)) {
        return this.ifTrue.simplify(ctx);
      } else {
        return this.ifFalse.simplify(ctx);
      }
    }
    return new ExprIf(
      this.cond.simplify(ctx),
      this.ifTrue.simplify(ctx),
      this.ifFalse.simplify(ctx),
    );
  }

  constant(ctx: EvalContext): boolean {
    if (this.cond.constant(ctx)) {
      if (this.cond.eval(ctx)) {
        return this.ifTrue.constant(ctx);
      } else {
        return this.ifFalse.constant(ctx);
      }
    }
    return false;
  }

  toString(): string {
    return `if ${this.cond.toStringWithParens(this.precedence())} then ${this.ifTrue.toStringWithParens(this.precedence())} else ${this.ifFalse.toStringWithParens(this.precedence())}`;
  }

  precedence(): number {
    return 0;
  }
}

/** A reference to a variable. */
export class ExprVar extends Expression {
  /** The dot-separated parts of this variable. */
  components: string[];

  constructor(components: string[]) {
    super();
    this.components = components;
  }

  eval(): number {
    throw new Error(`Variable '${this.toString()}' not defined!`);
  }

  simplify(): Expression {
    return this;
  }

  constant(): boolean {
    return false;
  }

  toString(): string {
    return this.components.join(".");
  }

  precedence(): number {
    return 9;
  }
}

/** A call to a function. */
export class ExprCall extends Expression {
  /** The function to call. */
  method: ExprVar;
  /** The arguments passed to this function. */
  args: Expression[];

  constructor(method: ExprVar, args: Expression[]) {
    super();
    this.method = method;
    this.args = args;
  }

  eval(): number {
    throw new Error(`Method '${this.method.toString()}' not defined!`);
  }

  simplify(ctx: EvalContext): Expression {
    return new ExprCall(
      this.method,
      this.args.map((a) => a.simplify(ctx)),
    );
  }

  constant(): boolean {
    return false;
  }

  toString(): string {
    return `${this.method.toString()}(${this.args.map((a) => a.toString()).join(", ")})`;
  }

  precedence(): number {
    return 9;
  }
}

/** The Ohm grammar for the expression language. */
const exprGrammar = ohm.grammar(String.raw`
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
    = ExprConst caseInsensitive<"d"> ExprConst DicePostfix* -- Dice
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
/** The Ohm semantics for the expression language. */
const exprSemantics = exprGrammar.createSemantics();

/** A typed version of the "parse" semantic action on Ohm nodes. */
function parse(expr: ohm.Node): Expression {
  return expr.parse();
}

/* eslint-disable @typescript-eslint/no-unused-vars */
exprSemantics.addOperation("varParts", {
  Var(part1, _, parts): string[] {
    return [part1.sourceString, ...parts.children.map((c) => c.sourceString)];
  },
});

exprSemantics.addOperation("dicePostfix", {
  DicePostfix_KeepHighest(_, arg): ExprDiceOptions {
    return {
      keepHighest: parse(arg),
    };
  },
  DicePostfix_KeepLowest(_, arg): ExprDiceOptions {
    return {
      keepLowest: parse(arg),
    };
  },
  DicePostfix_DropHighest(_, arg): ExprDiceOptions {
    return {
      dropHighest: parse(arg),
    };
  },
  DicePostfix_DropLowest(_, arg): ExprDiceOptions {
    return {
      dropLowest: parse(arg),
    };
  },
  DicePostfix_Explode(_): ExprDiceOptions {
    return {
      explode: true,
    };
  },
});

/** Get all the terminal or nonterminal children of a node, eliding all repitions. */
function nonIteratorChildren(node: ohm.Node): ohm.Node[] {
  if (!node.isIteration()) {
    return [node];
  }
  const result: ohm.Node[] = [];
  for (const child of node.children) {
    result.splice(result.length, 0, ...nonIteratorChildren(child));
  }
  return result;
}

exprSemantics.addOperation("parse", {
  ExprConst_Number(value): Expression {
    return new ExprNumber(Number.parseFloat(value.sourceString));
  },
  ExprConst_Parens(_1, value, _2): Expression {
    return parse(value);
  },
  ExprConst_Dice(nDice, _, nFaces, options): Expression {
    return new ExprDice(
      parse(nDice),
      parse(nFaces),
      nonIteratorChildren(options)
        .map((n) => n.dicePostfix() as ExprDiceOptions)
        .reduce((acc, n) => {
          return {
            ...acc,
            ...n,
          };
        }, {} as ExprDiceOptions),
    );
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
  ExprTag_Tag(lhs, _, tags): Expression {
    return parse(lhs).addTags(...tags.children.map((t) => t.sourceString));
  },
  ExprIf_If(_1, cond, _2, then, _3, otherwise) {
    return new ExprIf(parse(cond), parse(then), parse(otherwise));
  },
  ExprLiteral_Var(parts) {
    return new ExprVar(parts.varParts());
  },
  ExprLiteral_Call(method, _1, arg1, _2, args, _3, _4) {
    return new ExprCall(
      new ExprVar(method.varParts()),
      [...nonIteratorChildren(arg1), ...nonIteratorChildren(args)].map((p) =>
        parse(p),
      ),
    );
  },
});
/* eslint-enable */

/** Parse an expression string and return what the expression means semantically. */
export function parseExpression(expr: string | ohm.MatchResult): Expression {
  return exprSemantics(
    typeof expr === "string" ? exprGrammar.match(expr) : expr,
  ).parse();
}
