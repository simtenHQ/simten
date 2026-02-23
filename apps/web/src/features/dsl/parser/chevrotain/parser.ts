/**
 * Chevrotain Parser Grammar
 *
 * This parser implements the DSL grammar using Chevrotain's CstParser.
 * It produces a Concrete Syntax Tree (CST) that is then converted to AST.
 *
 * Key features:
 * - Error recovery enabled for multi-error reporting
 * - Grammar matches the EBNF spec in grammar.ebnf
 * - CST preserves source locations for error messages
 */

import { CstParser, IParserErrorMessageProvider } from 'chevrotain';
import {
  allTokens,
  Circuit,
  Input,
  Output,
  Clock,
  Node,
  Connect,
  State,
  Impl,
  Description,
  On,
  Rising,
  Falling,
  If,
  Else,
  Testbench,
  Use,
  As,
  Stimulus,
  Capture,
  Assert,
  At,
  Step,
  Signals,
  Format,
  Filename,
  In,
  Bit,
  Bus,
  Word,
  ArrayKw,
  True,
  False,
  Arrow,
  DotDot,
  Eq,
  Ne,
  Le,
  Ge,
  Assign,
  Lt,
  Gt,
  Plus,
  Minus,
  Star,
  Slash,
  Ampersand,
  Pipe,
  Caret,
  Tilde,
  Bang,
  LBrace,
  RBrace,
  LParen,
  RParen,
  LBracket,
  RBracket,
  Comma,
  Colon,
  Dot,
  AtSign,
  NumberLiteral,
  StringLiteral,
  Identifier,
} from './tokens';

// ============================================================================
// Custom Error Messages
// ============================================================================

const customErrorMessageProvider: IParserErrorMessageProvider = {
  buildMismatchTokenMessage({ expected, actual }) {
    return `Expected ${expected?.name ?? 'token'} but found '${actual.image}'`;
  },
  buildNotAllInputParsedMessage({ firstRedundant }) {
    return `Unexpected token '${firstRedundant.image}'`;
  },
  buildNoViableAltMessage({ expectedPathsPerAlt }) {
    const options = expectedPathsPerAlt
      .flat(2)
      .map((t) => t?.name ?? 'unknown')
      .join(', ');
    return `Expected one of: ${options}`;
  },
  buildEarlyExitMessage({ expectedIterationPaths }) {
    const options = expectedIterationPaths
      .flat(2)
      .map((t) => t?.name ?? 'unknown')
      .join(', ');
    return `Expected at least one of: ${options}`;
  },
};

// ============================================================================
// Parser Definition
// ============================================================================

export class DSLParser extends CstParser {
  constructor() {
    super(allTokens, {
      recoveryEnabled: true,
      errorMessageProvider: customErrorMessageProvider,
    });
    this.performSelfAnalysis();
  }

  // ==========================================================================
  // Program
  // ==========================================================================

  public program = this.RULE('program', () => {
    this.MANY(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.circuitDefinition) },
        { ALT: () => this.SUBRULE(this.testbenchDefinition) },
      ]);
    });
  });

  // ==========================================================================
  // Circuit Definition
  // ==========================================================================

  private circuitDefinition = this.RULE('circuitDefinition', () => {
    this.CONSUME(Circuit);
    this.CONSUME(Identifier, { LABEL: 'name' });
    this.OPTION(() => {
      this.SUBRULE(this.parameters);
    });
    this.CONSUME(LBrace);
    this.OPTION2(() => {
      this.CONSUME(Description);
      this.CONSUME(StringLiteral, { LABEL: 'descriptionText' });
    });
    this.MANY(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.inputDeclaration) },
        { ALT: () => this.SUBRULE(this.outputDeclaration) },
        { ALT: () => this.SUBRULE(this.clockDeclaration) },
        { ALT: () => this.SUBRULE(this.stateDeclaration) },
      ]);
    });
    this.OPTION3(() => {
      this.SUBRULE(this.implBlock);
    });
    this.CONSUME(RBrace);
  });

  private parameters = this.RULE('parameters', () => {
    this.CONSUME(LParen);
    this.SUBRULE(this.parameterDecl);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.SUBRULE2(this.parameterDecl);
    });
    this.CONSUME(RParen);
  });

  private parameterDecl = this.RULE('parameterDecl', () => {
    this.CONSUME(Identifier, { LABEL: 'name' });
    this.CONSUME(Colon);
    this.SUBRULE(this.parameterType);
    this.OPTION(() => {
      this.CONSUME(Assign);
      this.SUBRULE(this.literal);
    });
  });

  private parameterType = this.RULE('parameterType', () => {
    // Parameter types are identified by Identifier token with specific values
    // (Int, int, String, string, Bool, bool)
    this.CONSUME(Identifier, { LABEL: 'type' });
  });

  // ==========================================================================
  // Port Declarations
  // ==========================================================================

  private inputDeclaration = this.RULE('inputDeclaration', () => {
    this.CONSUME(Input);
    this.CONSUME(Identifier, { LABEL: 'name' });
    this.CONSUME(Colon);
    this.SUBRULE(this.typeExpr);
  });

  private outputDeclaration = this.RULE('outputDeclaration', () => {
    this.CONSUME(Output);
    this.CONSUME(Identifier, { LABEL: 'name' });
    this.CONSUME(Colon);
    this.SUBRULE(this.typeExpr);
  });

  private clockDeclaration = this.RULE('clockDeclaration', () => {
    this.CONSUME(Clock);
    this.CONSUME(Identifier, { LABEL: 'name' });
  });

  // ==========================================================================
  // State Declaration
  // ==========================================================================

  private stateDeclaration = this.RULE('stateDeclaration', () => {
    this.CONSUME(State);
    this.CONSUME(Identifier, { LABEL: 'name' });
    this.CONSUME(Colon);
    this.SUBRULE(this.stateTypeExpr);
    this.OPTION(() => {
      this.CONSUME(Assign);
      this.SUBRULE(this.literal);
    });
  });

  // ==========================================================================
  // Type Expressions
  // ==========================================================================

  private typeExpr = this.RULE('typeExpr', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.bitType) },
      { ALT: () => this.SUBRULE(this.busType) },
    ]);
  });

  private bitType = this.RULE('bitType', () => {
    this.CONSUME(Bit);
  });

  private busType = this.RULE('busType', () => {
    this.OR([{ ALT: () => this.CONSUME(Bus) }, { ALT: () => this.CONSUME(Word) }]);
    this.CONSUME(LBracket);
    this.SUBRULE(this.widthExpr);
    this.CONSUME(RBracket);
  });

  private widthExpr = this.RULE('widthExpr', () => {
    this.OR([
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(Identifier) },
    ]);
  });

  private stateTypeExpr = this.RULE('stateTypeExpr', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.memoryType) },
      { ALT: () => this.SUBRULE(this.typeExpr) },
    ]);
  });

  private memoryType = this.RULE('memoryType', () => {
    this.CONSUME(ArrayKw);
    this.CONSUME(LBracket);
    this.CONSUME(NumberLiteral, { LABEL: 'size' });
    this.CONSUME(Comma);
    this.SUBRULE(this.typeExpr);
    this.CONSUME(RBracket);
  });

  // ==========================================================================
  // Implementation Block
  // ==========================================================================

  private implBlock = this.RULE('implBlock', () => {
    this.CONSUME(Impl);
    this.CONSUME(LBrace);
    this.MANY(() => {
      this.SUBRULE(this.implItem);
    });
    this.CONSUME(RBrace);
  });

  private implItem = this.RULE('implItem', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.nodeDeclaration) },
      { ALT: () => this.SUBRULE(this.connectStatement) },
      { ALT: () => this.SUBRULE(this.onClockStatement) },
      { ALT: () => this.SUBRULE(this.assignment) },
    ]);
  });

  // ==========================================================================
  // Node Declaration
  // ==========================================================================

  private nodeDeclaration = this.RULE('nodeDeclaration', () => {
    this.CONSUME(Node);
    this.CONSUME(Identifier, { LABEL: 'instanceName' });
    this.CONSUME(Colon);
    this.CONSUME2(Identifier, { LABEL: 'componentType' });
    this.OPTION(() => {
      this.SUBRULE(this.arguments);
    });
  });

  private arguments = this.RULE('arguments', () => {
    this.CONSUME(LParen);
    this.SUBRULE(this.argument);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.SUBRULE2(this.argument);
    });
    this.CONSUME(RParen);
  });

  private argument = this.RULE('argument', () => {
    this.CONSUME(Identifier, { LABEL: 'name' });
    this.CONSUME(Assign);
    this.SUBRULE(this.argumentValue);
  });

  private argumentValue = this.RULE('argumentValue', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.arrayLiteral) },
      { ALT: () => this.SUBRULE(this.objectLiteral) },
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(True) },
      { ALT: () => this.CONSUME(False) },
      { ALT: () => this.CONSUME(Identifier) }, // Parameter reference
    ]);
  });

  private arrayLiteral = this.RULE('arrayLiteral', () => {
    this.CONSUME(LBracket);
    this.OPTION(() => {
      this.SUBRULE(this.argumentValue);
      this.MANY(() => {
        this.CONSUME(Comma);
        this.SUBRULE2(this.argumentValue);
      });
    });
    this.CONSUME(RBracket);
  });

  private objectLiteral = this.RULE('objectLiteral', () => {
    this.CONSUME(LBrace);
    this.OPTION(() => {
      this.SUBRULE(this.objectEntry);
      this.MANY(() => {
        this.CONSUME(Comma);
        this.SUBRULE2(this.objectEntry);
      });
    });
    this.CONSUME(RBrace);
  });

  private objectEntry = this.RULE('objectEntry', () => {
    this.CONSUME(NumberLiteral, { LABEL: 'key' });
    this.CONSUME(Colon);
    this.SUBRULE(this.argumentValue);
  });

  // ==========================================================================
  // Connect Statement
  // ==========================================================================

  private connectStatement = this.RULE('connectStatement', () => {
    this.CONSUME(Connect);
    this.SUBRULE(this.portRef, { LABEL: 'source' });
    this.CONSUME(Arrow);
    this.SUBRULE2(this.portRef, { LABEL: 'target' });
  });

  private portRef = this.RULE('portRef', () => {
    this.SUBRULE(this.portRefIdentifier, { LABEL: 'first' });
    this.OPTION(() => {
      this.CONSUME(Dot);
      this.SUBRULE2(this.portRefIdentifier, { LABEL: 'second' });
    });
  });

  // Allows certain keywords to be used as identifiers (common port names like 'in', 'on', etc.)
  private portRefIdentifier = this.RULE('portRefIdentifier', () => {
    this.OR([
      { ALT: () => this.CONSUME(Identifier) },
      { ALT: () => this.CONSUME(In) },
      { ALT: () => this.CONSUME(On) },
      { ALT: () => this.CONSUME(Input) },
      { ALT: () => this.CONSUME(Output) },
      { ALT: () => this.CONSUME(Clock) },
      { ALT: () => this.CONSUME(State) },
      { ALT: () => this.CONSUME(Node) },
    ]);
  });

  // ==========================================================================
  // Behavioral Statements
  // ==========================================================================

  private onClockStatement = this.RULE('onClockStatement', () => {
    this.CONSUME(On);
    this.CONSUME(Identifier, { LABEL: 'clockRef' });
    this.SUBRULE(this.clockEdge);
    this.CONSUME(LBrace);
    this.MANY(() => {
      this.SUBRULE(this.statement);
    });
    this.CONSUME(RBrace);
  });

  private clockEdge = this.RULE('clockEdge', () => {
    this.OR([{ ALT: () => this.CONSUME(Rising) }, { ALT: () => this.CONSUME(Falling) }]);
  });

  private statement = this.RULE('statement', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.conditionalStatement) },
      { ALT: () => this.SUBRULE(this.assignment) },
    ]);
  });

  private assignment = this.RULE('assignment', () => {
    this.CONSUME(Identifier, { LABEL: 'target' });
    this.CONSUME(Assign);
    this.SUBRULE(this.expression);
  });

  private conditionalStatement = this.RULE('conditionalStatement', () => {
    this.CONSUME(If);
    this.SUBRULE(this.expression, { LABEL: 'condition' });
    this.CONSUME(LBrace);
    this.MANY(() => {
      this.SUBRULE(this.statement, { LABEL: 'thenBody' });
    });
    this.CONSUME(RBrace);
    this.OPTION(() => {
      this.CONSUME(Else);
      this.CONSUME2(LBrace);
      this.MANY2(() => {
        this.SUBRULE2(this.statement, { LABEL: 'elseBody' });
      });
      this.CONSUME2(RBrace);
    });
  });

  // ==========================================================================
  // Expressions (with precedence handling)
  // ==========================================================================

  private expression = this.RULE('expression', () => {
    this.SUBRULE(this.orExpression);
  });

  // Precedence 1: |
  private orExpression = this.RULE('orExpression', () => {
    this.SUBRULE(this.xorExpression, { LABEL: 'lhs' });
    this.MANY(() => {
      this.CONSUME(Pipe);
      this.SUBRULE2(this.xorExpression, { LABEL: 'rhs' });
    });
  });

  // Precedence 2: ^
  private xorExpression = this.RULE('xorExpression', () => {
    this.SUBRULE(this.andExpression, { LABEL: 'lhs' });
    this.MANY(() => {
      this.CONSUME(Caret);
      this.SUBRULE2(this.andExpression, { LABEL: 'rhs' });
    });
  });

  // Precedence 3: &
  private andExpression = this.RULE('andExpression', () => {
    this.SUBRULE(this.equalityExpression, { LABEL: 'lhs' });
    this.MANY(() => {
      this.CONSUME(Ampersand);
      this.SUBRULE2(this.equalityExpression, { LABEL: 'rhs' });
    });
  });

  // Precedence 4: == !=
  private equalityExpression = this.RULE('equalityExpression', () => {
    this.SUBRULE(this.relationalExpression, { LABEL: 'lhs' });
    this.MANY(() => {
      this.OR([{ ALT: () => this.CONSUME(Eq) }, { ALT: () => this.CONSUME(Ne) }]);
      this.SUBRULE2(this.relationalExpression, { LABEL: 'rhs' });
    });
  });

  // Precedence 5: < > <= >=
  private relationalExpression = this.RULE('relationalExpression', () => {
    this.SUBRULE(this.additiveExpression, { LABEL: 'lhs' });
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(Lt) },
        { ALT: () => this.CONSUME(Gt) },
        { ALT: () => this.CONSUME(Le) },
        { ALT: () => this.CONSUME(Ge) },
      ]);
      this.SUBRULE2(this.additiveExpression, { LABEL: 'rhs' });
    });
  });

  // Precedence 6: + -
  private additiveExpression = this.RULE('additiveExpression', () => {
    this.SUBRULE(this.multiplicativeExpression, { LABEL: 'lhs' });
    this.MANY(() => {
      this.OR([{ ALT: () => this.CONSUME(Plus) }, { ALT: () => this.CONSUME(Minus) }]);
      this.SUBRULE2(this.multiplicativeExpression, { LABEL: 'rhs' });
    });
  });

  // Precedence 7: * /
  private multiplicativeExpression = this.RULE('multiplicativeExpression', () => {
    this.SUBRULE(this.unaryExpression, { LABEL: 'lhs' });
    this.MANY(() => {
      this.OR([{ ALT: () => this.CONSUME(Star) }, { ALT: () => this.CONSUME(Slash) }]);
      this.SUBRULE2(this.unaryExpression, { LABEL: 'rhs' });
    });
  });

  private unaryExpression = this.RULE('unaryExpression', () => {
    this.OR([
      {
        ALT: () => {
          this.OR2([
            { ALT: () => this.CONSUME(Bang) },
            { ALT: () => this.CONSUME(Tilde) },
            { ALT: () => this.CONSUME(Minus) },
          ]);
          this.SUBRULE(this.unaryExpression, { LABEL: 'operand' });
        },
      },
      { ALT: () => this.SUBRULE(this.primaryExpression) },
    ]);
  });

  private primaryExpression = this.RULE('primaryExpression', () => {
    this.OR([
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(True) },
      { ALT: () => this.CONSUME(False) },
      { ALT: () => this.CONSUME(Identifier) },
      {
        ALT: () => {
          this.CONSUME(LParen);
          this.SUBRULE(this.expression);
          this.CONSUME(RParen);
        },
      },
    ]);
  });

  // ==========================================================================
  // Literals
  // ==========================================================================

  private literal = this.RULE('literal', () => {
    this.OR([
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(True) },
      { ALT: () => this.CONSUME(False) },
    ]);
  });

  // ==========================================================================
  // Testbench Definition
  // ==========================================================================

  private testbenchDefinition = this.RULE('testbenchDefinition', () => {
    this.CONSUME(Testbench);
    this.CONSUME(Identifier, { LABEL: 'name' });
    this.CONSUME(LBrace);
    this.SUBRULE(this.circuitRef);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.testInputDeclaration) },
        { ALT: () => this.SUBRULE(this.testOutputDeclaration) },
        { ALT: () => this.SUBRULE(this.testClockDeclaration) },
      ]);
    });
    this.OPTION(() => {
      this.SUBRULE(this.testImplBlock);
    });
    this.CONSUME(RBrace);
  });

  private circuitRef = this.RULE('circuitRef', () => {
    this.CONSUME(Use);
    this.CONSUME(Circuit);
    this.CONSUME(Identifier, { LABEL: 'circuitName' });
    this.CONSUME(As);
    this.CONSUME2(Identifier, { LABEL: 'instanceName' });
  });

  private testInputDeclaration = this.RULE('testInputDeclaration', () => {
    this.CONSUME(Input);
    this.CONSUME(Identifier, { LABEL: 'name' });
    this.CONSUME(Colon);
    this.SUBRULE(this.testTypeExpr);
  });

  private testOutputDeclaration = this.RULE('testOutputDeclaration', () => {
    this.CONSUME(Output);
    this.CONSUME(Identifier, { LABEL: 'name' });
    this.CONSUME(Colon);
    this.SUBRULE(this.testTypeExpr);
  });

  private testClockDeclaration = this.RULE('testClockDeclaration', () => {
    this.CONSUME(Clock);
    this.CONSUME(Identifier, { LABEL: 'name' });
    this.OPTION(() => {
      this.CONSUME(AtSign);
      this.SUBRULE(this.frequencyExpr);
    });
  });

  private testTypeExpr = this.RULE('testTypeExpr', () => {
    this.OR([
      { ALT: () => this.CONSUME(Bit) },
      {
        ALT: () => {
          this.CONSUME(Bus);
          this.CONSUME(LBracket);
          this.CONSUME(NumberLiteral);
          this.CONSUME(RBracket);
        },
      },
    ]);
  });

  private frequencyExpr = this.RULE('frequencyExpr', () => {
    this.CONSUME(NumberLiteral, { LABEL: 'value' });
    this.CONSUME(Identifier, { LABEL: 'unit' });
  });

  // ==========================================================================
  // Testbench Implementation
  // ==========================================================================

  private testImplBlock = this.RULE('testImplBlock', () => {
    this.CONSUME(Impl);
    this.CONSUME(LBrace);
    this.MANY(() => {
      this.SUBRULE(this.testImplItem);
    });
    this.CONSUME(RBrace);
  });

  private testImplItem = this.RULE('testImplItem', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.testNodeDeclaration) },
      { ALT: () => this.SUBRULE(this.testConnectStatement) },
      { ALT: () => this.SUBRULE(this.stimulusBlock) },
      { ALT: () => this.SUBRULE(this.captureBlock) },
      { ALT: () => this.SUBRULE(this.assertBlock) },
    ]);
  });

  private testNodeDeclaration = this.RULE('testNodeDeclaration', () => {
    this.CONSUME(Node);
    this.CONSUME(Identifier, { LABEL: 'instanceName' });
    this.CONSUME(Colon);
    this.CONSUME2(Identifier, { LABEL: 'componentType' });
  });

  private testConnectStatement = this.RULE('testConnectStatement', () => {
    this.CONSUME(Connect);
    this.SUBRULE(this.portRef, { LABEL: 'source' });
    this.CONSUME(Arrow);
    this.SUBRULE2(this.portRef, { LABEL: 'target' });
  });

  // ==========================================================================
  // Stimulus Block
  // ==========================================================================

  private stimulusBlock = this.RULE('stimulusBlock', () => {
    this.CONSUME(Stimulus);
    this.CONSUME(On);
    this.CONSUME(Identifier, { LABEL: 'clockRef' });
    this.CONSUME(LBrace);
    this.MANY(() => {
      this.SUBRULE(this.stimulusEvent);
    });
    this.CONSUME(RBrace);
  });

  private stimulusEvent = this.RULE('stimulusEvent', () => {
    this.CONSUME(At);
    this.SUBRULE(this.stimulusTiming);
    this.CONSUME(Colon);
    this.SUBRULE(this.stimulusAssignment);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.SUBRULE2(this.stimulusAssignment);
    });
  });

  private stimulusTiming = this.RULE('stimulusTiming', () => {
    this.SUBRULE(this.expression, { LABEL: 'start' });
    this.OPTION(() => {
      this.CONSUME(DotDot);
      this.SUBRULE2(this.expression, { LABEL: 'end' });
      this.OPTION2(() => {
        this.CONSUME(Step);
        this.CONSUME(NumberLiteral, { LABEL: 'step' });
      });
    });
  });

  private stimulusAssignment = this.RULE('stimulusAssignment', () => {
    this.CONSUME(Identifier, { LABEL: 'signal' });
    this.CONSUME(Assign);
    this.SUBRULE(this.expression, { LABEL: 'value' });
  });

  // ==========================================================================
  // Capture Block
  // ==========================================================================

  private captureBlock = this.RULE('captureBlock', () => {
    this.CONSUME(Capture);
    this.CONSUME(LBrace);
    this.MANY(() => {
      this.SUBRULE(this.captureItem);
    });
    this.CONSUME(RBrace);
  });

  private captureItem = this.RULE('captureItem', () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.signalsDeclaration) },
      { ALT: () => this.SUBRULE(this.formatDeclaration) },
      { ALT: () => this.SUBRULE(this.filenameDeclaration) },
    ]);
  });

  private signalsDeclaration = this.RULE('signalsDeclaration', () => {
    this.CONSUME(Signals);
    this.CONSUME(Colon);
    this.CONSUME(LBracket);
    this.OPTION(() => {
      this.CONSUME(Identifier);
      this.MANY(() => {
        this.CONSUME(Comma);
        this.CONSUME2(Identifier);
      });
    });
    this.CONSUME(RBracket);
  });

  private formatDeclaration = this.RULE('formatDeclaration', () => {
    this.CONSUME(Format);
    this.CONSUME(Colon);
    this.CONSUME(Identifier);
  });

  private filenameDeclaration = this.RULE('filenameDeclaration', () => {
    this.CONSUME(Filename);
    this.CONSUME(Colon);
    this.CONSUME(StringLiteral);
  });

  // ==========================================================================
  // Assert Block
  // ==========================================================================

  private assertBlock = this.RULE('assertBlock', () => {
    this.CONSUME(Assert);
    this.CONSUME(On);
    this.CONSUME(Identifier, { LABEL: 'clockRef' });
    this.CONSUME(LBrace);
    this.MANY(() => {
      this.SUBRULE(this.assertionItem);
    });
    this.CONSUME(RBrace);
  });

  private assertionItem = this.RULE('assertionItem', () => {
    this.CONSUME(At);
    this.SUBRULE(this.stimulusTiming);
    this.CONSUME(Colon);
    this.SUBRULE(this.expression, { LABEL: 'condition' });
    this.OPTION(() => {
      this.CONSUME(Comma);
      this.CONSUME(StringLiteral, { LABEL: 'message' });
    });
  });
}

// ============================================================================
// Parser Instance
// ============================================================================

// Singleton instance (Chevrotain recommendation for performance)
export const parserInstance = new DSLParser();
