#!/bin/bash
#
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
IMAGE=${1}
TRAVIS_COMMIT=$4
USERNAME=$2
PASSWORD=$3
ARTIFACTORY_ID=sys-mcs-docker-local
ARTIFACTORY_URL=${ARTIFACTORY_ID}.artifactory.swg-devops.com

#Get tags for images into a file
curl -s -u $USERNAME:$PASSWORD -X GET https://${ARTIFACTORY_URL}/v2/$IMAGE/tags/list > tags.json
#Get information on all iamges in the repo
curl -s -u $USERNAME:$PASSWORD -X POST https://na.artifactory.swg-devops.com/artifactory/api/search/aql -H "content-type: text/plain" -d 'items.find({"repo":{"$eq":"'${ARTIFACTORY_ID}'"}})' > results.json
#Count the number of image tags in the repo
imagecount=$(jq '.tags | length' tags.json)
echo "Amount of image in repo: "$imagecount
counter=0
imagestokeep=5
> images.txt
while (($counter < $imagecount)); do
  #Get one tag from file into veriable
  line=0
  tag=$(cat tags.json | jq '.tags['$counter']')
  #Remove "" from the tag variable
  newtag=$(echo "$tag" | sed -e 's/^"//' -e 's/"$//')
  #Display only images with given tag
  cat results.json | jq '.results[] | select(.path | contains("'$IMAGE'/'$newtag'")) | .modified' > dates.txt
  #Get the date and time of image
  date=$(sort -r dates.txt | head -n 1)
  #Split up date into date and time
  date2=${date%T*}
  time2=${date#*T}
  #Remove "" from date
  date=$(echo "$date2 $time2" | sed -e 's/^"//' -e 's/"$//')
  newdate=$(date -d "$date" '+%s')
  echo $IMAGE/$newtag:$newdate | cat - images.txt > temp && mv temp images.txt
  counter=$((counter+1))
done
cat images.txt
rm dates.txt
rm results.json
rm tags.json

while read in; do echo $in | cut -f 2 -d : >> ordered.txt; done < images.txt
sort ordered.txt >> new.txt
filelines=$(cat images.txt | wc -l)
count2=1
while (($imagestokeep < $filelines)); do
  compareline=$(sed "${count2}q;d" new.txt)
  test=$(grep $compareline images.txt)
  imagetodelete=$(echo $test | cut -d: -f1)
  # number should be max length of $IMAGE/latest; currently microclimate-file-watcher/latest
  if [ ! ${#imagetodelete} -ge 58 ]; then
    echo "Skipping image: "$imagetodelete
  else
    curl -u $USERNAME:$PASSWORD -X DELETE https://na.artifactory.swg-devops.com/artifactory/${ARTIFACTORY_ID}/$imagetodelete/
    echo "Image that will be deleted: "$imagetodelete
  fi
  imagestokeep=$((imagestokeep+1))
  count2=$((count2+1))
done

#Cleanup
rm images.txt
rm ordered.txt
rm new.txt
