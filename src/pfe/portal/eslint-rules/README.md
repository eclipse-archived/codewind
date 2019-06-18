# eslint-plugin-microclimate-portal-eslint

Custom eslint rules for the microclimate portal

## Installation

You'll first need to install [ESLint](http://eslint.org):

```
$ npm i eslint --save-dev
```

Next, install `eslint-plugin-microclimate-portal-eslint`:

```
$ npm install eslint-plugin-microclimate-portal-eslint --save-dev
```

**Note:** If you installed ESLint globally (using the `-g` flag) then you must also install `eslint-plugin-microclimate-portal-eslint` globally.

## Usage

Add `microclimate-portal-eslint` to the plugins section of your `.eslintrc` configuration file. You can omit the `eslint-plugin-` prefix:

```json
{
    "plugins": [
        "microclimate-portal-eslint"
    ]
}
```


Then configure the rules you want to use under the rules section.

```json
{
    "rules": {
        "microclimate-portal-eslint/rule-name": 2
    }
}
```

## Supported Rules

* Fill in provided rules here





