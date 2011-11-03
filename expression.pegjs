{
    var E = require("./rebound").Expressions;
}

start
  = whitespace main:additive whitespace { return main; }

additive
  = firstTerm:multiplicative lastTerms:( whitespace "+" whitespace term:multiplicative { return term; })+ { 
      lastTerms.unshift(firstTerm);
      return new E.Addition(lastTerms); 
    }
  
  / firstTerm:multiplicative lastTerms:( whitespace "-" whitespace term:multiplicative { return term; })+ { 
      if (lastTerms.length == 1) {
        return new E.Subtraction(firstTerm, lastTerms[0]);
      } else {
        return new E.Subtraction(firstTerm, new E.Addition(lastTerms));
      }
    }
  / multiplicative

multiplicative
  = firstTerm:power lastTerms:( whitespace "*" whitespace term:power { return term; })+ { 
      lastTerms.unshift(firstTerm);
      return new E.Multiplication(lastTerms); 
    }

  / numerator:power denominator:( whitespace "/" whitespace term:power { return term; })+ { 
      if (denominator.length == 1) {
        return new E.Division(numerator, denominator[0]);
      } else {
        return new E.Division(numerator, new E.Multiplication(denominator));
      }
    }
  / power

power
  = base:primary exponents:( whitespace "^" whitespace exponent:primary { return exponent; })+ {
      if (exponents.length == 1) {
        return new E.Exponential(base, exponents[0]);
      } else {
        return new E.Exponential(base, new E.Multiplication(exponents));
      }
    }
  / primary

primary
  = integer
  / binding
  / "(" whitespace additive:additive whitespace ")" { return additive; }

binding
  = "{" whitespace ref:reference whitespace "}" { return new E.Reference(ref); }

reference
  = attribute:attribute "." ref:reference { ref.unshift(attribute); return ref } 
  / attribute:attribute { return [attribute]; }

attribute
  = first:[a-zA-Z_$] rest:[0-9a-zA-Z_$]* { return first + rest.join(""); }

object
  = attribute:attribute "." object:object { return attribute + "." + object; }
  / attribute

integer "integer"
  = digits:[0-9]+ { return new E.Number(parseInt(digits.join(""), 10)); }

whitespace
  = [ \t]*
