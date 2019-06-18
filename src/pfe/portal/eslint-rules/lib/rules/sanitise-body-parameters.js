/*******************************************************************************
 * Copyright (c) 2019 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/
"use strict";

//------------------------------------------------------------------------------
// Rule Definition - Ensures parameters from req.body are santitised before use.
//------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: "Ensures parameters from req.body are santitised before use.",
      category: "Fill me in",
      recommended: false
    },
    fixable: null,  // or "code" or "whitespace"
    schema: [
      // fill in your schema
    ]
  },

  create: function(context) {

    // variables should be defined here

    //----------------------------------------------------------------------
    // Helpers
    //----------------------------------------------------------------------

    function getPropertyName(property) {
      let propertyName = '<unknown>';
      if (property.type === 'Literal') {
        propertyName = property.value;
      } else if (property.type === 'Identifier') {
        propertyName = property.name;
      }
      return propertyName;
    }

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    return {
      MemberExpression: function (node) {
        // Look at member expressions with properties.
        if (node.object.type == 'MemberExpression' && node.object) {
          // console.dir(node);
          let nodeObject = node.object;
          if (nodeObject.object.name == 'req') {
            let reqChildName = getPropertyName(nodeObject.property);
            if (reqChildName === 'body' || reqChildName === 'params') {
              let reqField = getPropertyName(node.property);
              if (node.property.type === 'Literal') {
                reqField = node.property.value;
              } else if (node.property.type === 'Identifier') {
                reqField = node.property.name;
              }
              let message = `Unsanitised access to request field 'req.${reqChildName}.${reqField}'`;
              context.report({ node: node, message });
            }
          }
        }
      }
    };
  }
};
