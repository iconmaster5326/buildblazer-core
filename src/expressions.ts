import * as ohm from "ohm-js";

export class Expression {}

export class ExprNumber extends Expression {
  value: number;

  constructor(value: number) {
    super();
    this.value = value;
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
}

export const exprGrammar = ohm.grammar(String.raw`
Expression {
  Expr
    = ExprIf

  ExprIf
    = caseInsensitive<"if"> Expr caseInsensitive<"then"> Expr caseInsensitive<"else"> Expr -- If
    | ExprOr
  
  ExprOr
    = ExprOr caseInsensitive<"or"> ExprAnd -- Or
    | ExprAnd

  ExprAnd
    = ExprAnd caseInsensitive<"and"> ExprEq -- And
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
    = ExprMath3 "^" ExprDice -- Exp
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
  return expr.parse()
}

exprSemantics.addOperation("parse", {
  ExprConst_Number(value): Expression {
    return new ExprNumber(Number.parseFloat(value.sourceString));
  },
  ExprMath1_Add(lhs, _, rhs): Expression {
    return new ExprBin(parse(lhs), ExprBinOp.ADD, parse(rhs));
  }
});

export function parseExpression(expr: string | ohm.MatchResult): Expression {
  return exprSemantics(typeof(expr) === "string" ? exprGrammar.match(expr) : expr).parse();
}
