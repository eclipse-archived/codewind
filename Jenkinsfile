#!groovy
pipeline {
    agent {
        label "docker-build"
    }
    
    triggers {	
      issueCommentTrigger('trigger_build')	
    }

    options {
        timestamps()
        skipStagesAfterUnstable()
    }

    stages {
        stage('Build Docker images') {
            steps {
                withDockerRegistry([url: 'https://index.docker.io/v1/', credentialsId: 'docker.com-bot']) {
                    
                    // NOTE: change of this sh call should be in sync with './script/build.sh'. 
                    sh '''#!/usr/bin/env bash
                        echo "Starting build for Eclipse Codewind ..."
                        
                        DIR=`pwd`;
                        SRC_DIR=$DIR/src;
                        PFE=pfe
                        INITIALIZE=initialize
                        PERFORMANCE=performance;
                        ARCH=`uname -m`;
                        TAG=latest;
                        REGISTRY=eclipse

                        # On intel, uname -m returns "x86_64", but the convention for our docker images is "amd64"
                        if [ "$ARCH" == "x86_64" ]; then
                            IMAGE_ARCH="amd64"
                        else
                            IMAGE_ARCH=$ARCH
                        fi

                        ALL_IMAGES="$PFE $PERFORMANCE $INITIALIZE";

                        # Copy .env over to file-watcher
                        if [ -f $DIR/.env ]; then
                            echo -e "\nCopying $DIR/.env to ${SRC_DIR}/${PFE}/file-watcher/scripts/.env\n"
                            cp $DIR/.env ${SRC_DIR}/${PFE}/file-watcher/scripts/.env
                        fi

                        # Copy the license files to the portal, performance, initialize
                        cp -r $DIR/LICENSE.md ${SRC_DIR}/pfe/portal/
                        cp -r $DIR/NOTICE.md ${SRC_DIR}/pfe/portal/
                        cp -r $DIR/LICENSE ${SRC_DIR}/initialize/
                        cp -r $DIR/NOTICE.md ${SRC_DIR}/initialize/
                        cp -r $DIR/LICENSE.md ${SRC_DIR}/performance/
                        cp -r $DIR/NOTICE.md ${SRC_DIR}/performance/

                        # Copy the docs into portal
                        cp -r $DIR/docs ${SRC_DIR}/pfe/portal/

                        echo -e "\n+++   DOWNLOADING EXTENSIONS   +++\n";
                        mkdir -p ${SRC_DIR}/pfe/extensions
                        rm -f ${SRC_DIR}/pfe/extensions/codewind-appsody-extension-*.zip
                        curl -Lo ${SRC_DIR}/pfe/extensions/codewind-appsody-extension-0.3.0.zip https://github.com/eclipse/codewind-appsody-extension/archive/0.3.0.zip

                        # BUILD IMAGES
                        # Uses a build file in each of the directories that we want to use
                        echo -e "\n+++   BUILDING DOCKER IMAGES   +++\n";

                        for image in $ALL_IMAGES
                        do
                            export IMAGE_NAME=codewind-$image-$IMAGE_ARCH
                            echo Building image $IMAGE_NAME;
                            cd ${SRC_DIR}/${image};
                            time sh build Dockerfile_${ARCH};

                            if [ $? -eq 0 ]; then
                                echo "+++   SUCCESSFULLY BUILT $IMAGE_NAME   +++";
                            else
                                echo "+++   FAILED TO BUILD $IMAGE_NAME - exiting.   +++";
                                exit 12;
                            fi
                        done;
                        echo -e "\n+++   ALL DOCKER IMAGES SUCCESSFULLY BUILT   +++\n";
                        docker images | grep codewind;
                    '''
                }
            }
        }  
        
        stage('Publish Docker images') {

            // This when clause disables PR build uploads; you may comment this out if you want your build uploaded.
            when {
                beforeAgent true
                not {
                    changeRequest()
                }
            }
            
            steps {
                withDockerRegistry([url: 'https://index.docker.io/v1/', credentialsId: 'docker.com-bot']) {
                    sh '''#!/usr/bin/env bash
                        echo "Publishing docker images for Eclipse Codewind ..."
                        export REGISTRY="eclipse"
                        echo "Branch name is $GIT_BRANCH"

                        if [[ $GIT_BRANCH == "master" ]]; then
                            TAG="latest"
                        else
                            TAG=$GIT_BRANCH
                        fi        

                        # Publish docker images with a filter for branch name
                        # Acceptable branch names: master, start with '<number>.<number>'
                        if [[ $GIT_BRANCH == "master" ]] || [[ $GIT_BRANCH =~ ^([0-9]+\\.[0-9]+) ]]; then

                            declare -a DOCKER_IMAGE_ARRAY=("codewind-initialize-amd64" 
                                                        "codewind-performance-amd64" 
                                                        "codewind-pfe-amd64")

                            chmod u+x ./script/publish.sh

                            for i in "${DOCKER_IMAGE_ARRAY[@]}"
                            do
                                echo "Publishing $REGISTRY/$i:$TAG"
                                ./script/publish.sh $i $REGISTRY $TAG
                            done
                        else
                            echo "Skip publishing docker images for $GIT_BRANCH branch"
                        fi
                    '''
                }
             }
        } 
    }
}
