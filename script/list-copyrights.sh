#!/usr/bin/env bash
#*******************************************************************************
# Copyright (c) 2019 IBM Corporation and others.
# All rights reserved. This program and the accompanying materials
# are made available under the terms of the Eclipse Public License v2.0
# which accompanies this distribution, and is available at
# http://www.eclipse.org/legal/epl-v20.html
#
# Contributors:
#     IBM Corporation - initial API and implementation
#*******************************************************************************


# USAGE     list-copyrights {optional list of direcories}
#
# list-copyrights
# list-copyrights "node_modules client jmeter"
#

# check to see if a directory has been defined via a parameter, else use wildcard and search all
dirpath=*
if [ ! -z "$1" ]; then
  dirpath=$1
fi

grep -irI "Copyright [0-9]\|Copyright (" $dirpath | awk '{
        
# From the grep output,  first extract the filename which should be terminated with a colon as this will form the first column in the .csv output
        rc =split($0,a,":")

# Once we have the filename from the string,   the rest of the output should contain the copyright text, Attempt to filter the copyright text out of the remaining
# string data. First remove any unwanted text found before the initial Copyright statement   

        copyPos=match(a[2],"\w*Copyright")
        copyStr=substr(a[2],copyPos)


# As the destination for the copyright ouput is cell two of the csv, search through the remaining text and substitue any commas for spaces to ensure the text populates
# one field in the final output  

        gsub(/,/," ",copyStr)

# After parsing the data it was apparant that different vendor/authors use different copyright formats,  attempt to tidy this up ready for our own purposes. 

        gsub("&gt",">",copyStr)
        gsub("&lt","<",copyStr)
        gsub("&quot",/"/,copyStr)
        gsub("/** @license MIT "," ",copyStr)
        gsub("/** License "," ",copyStr)
        gsub("See License.txt in the project root for license information."," ",copyStr) 
        gsub("@license   Licensed under MIT license"," ",copyStr)
        print a[1],",",copyStr
}'  $i
