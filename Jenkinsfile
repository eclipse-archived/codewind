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

                        # Docker system prune
                        echo "Docker system prune ..."
                        docker system df
                        docker system prune -a -f
                        docker builder prune -a -f
                        docker system df
                        df -lh

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
        /*
        stage('Run Codewind test suite') {            
                steps {
                    withEnv(["PATH=$PATH:~/.local/bin;NOBUILD=true"]){
                    withDockerRegistry([url: 'https://index.docker.io/v1/', credentialsId: 'docker.com-bot']) {
                        sh '''#!/usr/bin/env bash
                        echo "Starting tests for Eclipse Codewind ..."
                        export PATH=$PATH:/home/jenkins/.jenkins/tools/jenkins.plugins.nodejs.tools.NodeJSInstallation/node_js/bin/

                        ARCH=`uname -m`;
                        printf "\n\n${MAGENTA}Platform: $ARCH ${RESET}\n"

                        # Install nvm to easily set version of node to use
                        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
                        export NVM_DIR="$HOME/.nvm" 
                        . $NVM_DIR/nvm.sh
                        nvm i 10

                        # Install docker-compose 
                        curl -L https://github.com/docker/compose/releases/download/1.21.2/docker-compose-`uname -s`-`uname -m` -o ~/docker-compose
                        chmod +x ~/docker-compose

                        # Run eslint on portal code
                        cd src/pfe/portal
                        npm install
                        npm run eslint
                        if [ $? -ne 0 ]; then
                            exit 1
                        fi
                        cd ../../..

                        # Create codewind-workspace if it does not exist
                        printf "\n\nCreating codewind-workspace\n"
                        mkdir -m 777 -p codewind-workspace

                        export REPOSITORY='';
                        export TAG
                        export WORKSPACE_DIRECTORY=$PWD/codewind-workspace;
                        export HOST_OS=$(uname);
                        export REMOTE_MODE;
                        export HOST_HOME=$HOME
                        export ARCH=$(uname -m);
                        # Select the right images for this architecture.
                        if [ "$ARCH" = "x86_64" ]; then
                          export PLATFORM="-amd64"
                        else
                          export PLATFORM="-$ARCH"
                        fi

                        # Start codewind running
                        ~/docker-compose -f docker-compose.yaml -f docker-compose-local.yaml up -d;

                        if [ $? -eq 0 ]; then
                            # Reset so we don't get conflicts
                            unset REPOSITORY;
                            unset WORKSPACE_DIRECTORY;
                            unset REMOTE_MODE;
                            printf "\n\n${GREEN}SUCCESSFULLY STARTED CONTAINERS $RESET\n";
                            printf "\nCurrent running codewind containers\n";
                            docker ps --filter name=codewind
                        else
                            printf "\n\n${RED}FAILED TO START CONTAINERS $RESET\n";
                            exit;
                        fi

                        printf "\n\nPausing for 20 seconds to allow containers to start\n";
                        sleep 20;

                        # Check to see if any containers exited straight away
                        printf "\n\n${BLUE}CHECKING FOR codewind CONTAINERS THAT EXITED STRAIGHT AFTER BEING RUN $RESET\n";
                        EXITED_PROCESSES=$(docker ps -q --filter "name=codewind" --filter "status=exited"  | wc -l)
                        if [ $EXITED_PROCESSES -gt 0 ]; then
                          printf "\n${RED}Exited containers found $RESET\n";
                          # docker ps --filter "name=codewind" --filter "status=exited";
                          NUM_CODE_ZERO=$(docker ps -q --filter "name=codewind" --filter "status=exited" --filter "exited=0" | wc -l);
                          NUM_CODE_ONE=$(docker ps -q --filter "name=codewind" --filter "status=exited" --filter "exited=1" | wc -l);
                          if [ $NUM_CODE_ZERO -gt 0 ]; then
                            printf "\n${RED}$NUM_CODE_ZERO found with an exit code '0' $RESET\n";
                            docker ps --filter "name=codewind" --filter "status=exited" --filter "exited=0";
                            printf "\nUse 'docker logs [container name]' to find why the exit happened";
                          fi
                          if [ $NUM_CODE_ONE -gt 0 ]; then
                            printf "\n${RED}$NUM_CODE_ONE found with an exit code '1' $RESET\n";
                            docker ps --filter "name=codewind" --filter "status=exited" --filter "exited=1";
                            printf "\nUse 'docker logs [container name]' to debug exit";
                          fi
                        else
                          printf "\nNo containers exited \n";
                        fi

                        printf "\n\ncodewind now available\n";

                        # Build the tests and run them against the portal.
                        cd test/
                        npm install
                        npm run eslint
                        npm run test
                        '''
                    }
                }
            }
        } 
        */ 
        
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
    post {
        always {
           sh '''#!/usr/bin/env bash
  
              # Output portal logs
              printf "\n********** codewind-pfe logs **********\n\n"
              docker logs codewind-pfe

              # Shutdown and cleanup.
              printf "\nStopping and removing Codewind Docker containers.\n"
              DOCKER_PS="docker ps -a -q  --filter name=codewind";
              DOCKER_IMAGES="docker images -q --filter reference=codewind*";

              DOCKER_PS_APPS="docker ps -a -q  --filter name=cw";
              DOCKER_IMAGES_APPS="docker images -q --filter reference=cw*";

              # Check to make sure that there are actually proceses to remove
              NUMBER_OF_PROCESSES=$($DOCKER_PS | wc -l)
              if [ $NUMBER_OF_PROCESSES -gt 0 ]; then
                # Removing containers

                printf "\nStopping all running containers\n";

                docker rm -f $($DOCKER_PS)
                if [ $? -eq 0 ]; then
                    printf "\nSuccessfully removed containers\n";
                else
                    printf "\nError removing containers\n";
                    exit;
                fi
                printf "\nSUCCESSFULLY REMOVED CONTAINERS\n";
              else
                printf "\nERROR: THERE ARE NO CONTAINERS TO REMOVE\n";
              fi

              # Check to make sure that there are actually proceses to remove
              NUMBER_OF_PROCESSES=$($DOCKER_PS_APPS | wc -l)
              if [ $NUMBER_OF_PROCESSES -gt 0 ]; then
                # Removing containers
                docker rm -f $($DOCKER_PS_APPS)
                if [ $? -eq 0 ]; then
                    printf "\n${GREEN}Successfully removed containers $RESET\n";
                else
                    printf "\n${RED}Error removing containers $RESET\n";
                    exit;
                fi
                printf "\n${GREEN}SUCCESSFULLY REMOVED CONTAINERS $RESET\n";
              else
                printf "\n${RED}ERROR: THERE ARE NO CONTAINERS TO REMOVE $RESET\n";
              fi

              # Remove the codewind network
              printf "\nRemoving docker network\n";
              docker network rm codewind_network
              if [ $? -eq 0 ]; then
                  printf "\n${GREEN}Successfully removed docker network $RESET\n";
              else
                  printf "\n${RED}Error removing docker network $RESET\n";
              fi

              # Remove the default network
              printf "\nRemoving docker network\n";
              docker network rm codewind_default
              if [ $? -eq 0 ]; then
                  printf "\n${GREEN}Successfully removed docker network $RESET\n";
              else
                  printf "\n${RED}Error removing docker network $RESET\n";
              fi

              # Docker system prune
              echo "Docker system prune ..."
              docker system df
              docker system prune -a -f
              docker builder prune -a -f
              docker system df
              df -lh
            '''
        }
        failure {
          sh '''#!/usr/bin/env bash
            printf "The PR failed";
          '''
        }
    }
}
