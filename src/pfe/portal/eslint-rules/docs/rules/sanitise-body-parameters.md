# Ensures parameters from req.body are santitised before use. (santise-body-parameters)

Please describe the origin of the rule here.


## Rule Details

This rule aims to prevent access to express request paramters without
santizing them to prevent malicious input being propogated into values
we store, log or send back to the end user.

Examples of **incorrect** code for this rule:

```js

const name = req.body.name;

```

Examples of **correct** code for this rule:

```js

const name = req.sanitiseBody('name');

```

## When Not To Use It

This rule is only probably only appropriate when using express and
assumes handlers follow the standard pattern:

```js
function(req, res, next) {
  //some code.
}
```

## Further Reading

- https://www.owasp.org/index.php/Testing_for_Reflected_Cross_site_scripting_(OTG-INPVAL-001)
