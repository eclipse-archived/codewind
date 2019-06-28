/*******************************************************************************
* Copyright (c) 2019 IBM Corporation and others.
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the Eclipse Public License v2.0
* which accompanies this distribution, and is available at
* http://www.eclipse.org/legal/epl-v20.html
*
* Contributors:
*     IBM Corporation - initial API and implementation
******************************************************************************/

import React from 'react'
import './GridLayout.scss'

const GridColumn = ({ children }) => (
  <div className="gridLayoutCard">
    {children}
  </div>
);

export default function GridLayout() {
  return (
    <div className="gridLayout-container">
      <div className="gridLayout-cols">
        <GridColumn> <div className='gridSizeName pulsate'></div> </GridColumn>
        <GridColumn>02</GridColumn>
        <GridColumn>03</GridColumn>
        <GridColumn>04</GridColumn>
        <GridColumn>05</GridColumn>
        <GridColumn>06</GridColumn>
        <GridColumn>07</GridColumn>
        <GridColumn>08</GridColumn>
        <GridColumn>09</GridColumn>
        <GridColumn>10</GridColumn>
        <GridColumn>11</GridColumn>
        <GridColumn>12</GridColumn>
        <GridColumn>13</GridColumn>
        <GridColumn>14</GridColumn>
        <GridColumn>15</GridColumn>
        <GridColumn>16</GridColumn>
      </div>
    </div>
  )
}
