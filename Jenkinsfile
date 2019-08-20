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

        stage('Run Codewind test suite') {
            
                steps {
                    withEnv(["PATH=$PATH:~/.local/bin;NOBUILD=true"]){
                    withDockerRegistry([url: 'https://index.docker.io/v1/', credentialsId: 'docker.com-bot']) {
                        sh '''#!/usr/bin/env bash
                        echo "Starting tests for Eclipse Codewind ..."
                        export PATH=$PATH:/home/jenkins/.jenkins/tools/jenkins.plugins.nodejs.tools.NodeJSInstallation/node_js/bin/


                        MAGENTA='\033[0;35m'
                        BLUE='\033[0;34m'
                        RED='\033[0;31m'
                        RESET='\033[0m'



                        ARCH=`uname -m`;

                        printf "\n\n${MAGENTA}Platform: $ARCH ${RESET}\n"
                        # Run filewatcher tests if the scope is set accordingly, otherwise default to portal


                        # Run eslint
                        echo $PATH

                        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash

                        export NVM_DIR="$HOME/.nvm" 
  

                        nvm i 10


                        curl -L https://github.com/docker/compose/releases/download/1.21.2/docker-compose-`uname -s`-`uname -m` -o ~/docker-compose
                        chmod +x ~/docker-compose


                        cd src/pfe/portal
                        npm install
                        npm run eslint
                        if [ $? -ne 0 ]; then
                            exit 1
                        fi
                        cd ../../..


                        # CREATE CODEWIND-WORKSPACE IF NOT EXISTS
                        printf "\n\n${BLUE}CREATING CODEWIND-WORKSPACE IF IT DOESN'T EXIST${RESET}\n"
                        mkdir -m 777 -p codewind-workspace

                        export REPOSITORY='';
                        export TAG
                        export WORKSPACE_DIRECTORY=$PWD/codewind-workspace;
                        # Export HOST_OS for fix to Maven failing on Windows only as host
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


                        docker-compose -f docker-compose.yaml -f docker-compose-local.yaml up -d;

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

                        printf "\n\n${BLUE}PAUSING TO ALLOW CONTAINERS TIME TO START $RESET\n";
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
                          printf "\nNo containers exited $RESET\n";
                        fi

                        printf "\n\ncodewind CONTAINERS NOW AVAILABLE\n";




                        # Build the tests and run them against the portal.
                        cd test/
                        npm install
                        npm run eslint
                        if [[ ! -z $TRAVIS_BUILD_NUMBER && $? -ne 0 ]]; then
                          exit 1
                        fi

                        npm run test
                        rc=$?;
                        cd ..

                        # Output portal logs
                        printf "\n********** codewind-pfe logs **********\n\n"
                        docker logs codewind-pfe
                        printf "${RESET}"

                        # Shutdown and cleanup.
                        GREEN='\033[0;32m'
                        RED='\033[0;31m'
                        BLUE='\033[0;36m'
                        RESET='\033[0m'

                        REMOVE_IMAGES=false;
                        REMOVE_ALL=false;
                        REMOVE_UNTAGGED=false;
                        REMOVE_APP_IMAGES=false;

                        # flags
                        while test $# -gt 0; do
                          case "$1" in
                            -h|--help)
                              printf "\n./stop.sh [options]\n\n";
                              echo "options:";
                              echo "   -h, --help";
                              echo "   -a, --all";
                              echo "       Stop and remove ALL Docker containers instead of just Codewind ones.";
                              echo "   -p, --appimages";
                              echo "       Remove application images as well as containers.";
                              echo "   -i, --images";
                              echo "       Remove images as well as containers.";
                              echo "       Hint: Use with --all to remove clear your Docker repository (remove containers and images).";
                              echo "   -u, --untagged";
                              echo "       Remove images untagged images (tag will look like: <none>).";
                              echo "       Hint: This helps to recover space in your Docker repository.";
                              exit;
                              ;;
                            -a|--all)
                              REMOVE_ALL=true;
                              shift
                              ;;
                            -i|--images)
                              echo "The Docker images will also be removed";
                              REMOVE_IMAGES=true;
                              shift
                              ;;
                            -p|--appimages)
                              echo "The Application Docker images will also be removed";
                              REMOVE_APP_IMAGES=true;
                              shift
                              ;;
                            -u|--untagged)
                              echo "The Docker images will also be removed";
                              REMOVE_UNTAGGED=true;
                              shift
                              ;;
                            *)
                              break;
                              ;;
                          esac
                        done

                        # If REMOVE_ALL then remove all containers instead of just Codewind ones
                        if [ ${REMOVE_ALL} = true ]; then
                          printf "\nStopping and removing ALL Docker containers instead of just Codewind ones.\n";
                          DOCKER_PS="docker ps -a -q";
                          DOCKER_IMAGES="docker images -q";
                        else
                          printf "\nStopping and removing Codewind Docker containers.\n"
                          DOCKER_PS="docker ps -a -q  --filter name=codewind";
                          DOCKER_IMAGES="docker images -q --filter reference=codewind*";
                        fi

                        DOCKER_PS_APPS="docker ps -a -q  --filter name=cw";
                        DOCKER_IMAGES_APPS="docker images -q --filter reference=cw*";

                        # Check to make sure that there are actually proceses to remove
                        NUMBER_OF_PROCESSES=$($DOCKER_PS | wc -l)
                        if [ $NUMBER_OF_PROCESSES -gt 0 ]; then
                          # Removing containers
                          printf "\n${BLUE}Running 'stop.sh' to stop and remove Docker containers. ${RESET}\n";
                          printf "Docker ps script is '${DOCKER_PS}'\n";

                          printf "\nStopping all running containers\n";

                          docker rm -f $($DOCKER_PS)
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

                        # Remove images if --image or -i tag is given
                        if [ ${REMOVE_IMAGES} = true ]; then
                          # Check to make sure that there are images to remove
                          NUMBER_OF_IMAGES=$($DOCKER_IMAGES | wc -l)
                          if [ $NUMBER_OF_IMAGES -gt 0 ]; then
                            # Sleep as removing Docker images can be inconvenient if done by accident
                            printf "\n${BLUE}NOW REMOVING IMAGES.\nTHIS IS IRREVERSIBLE SO PAUSING FOR 5 SECONDS.${RESET}\n";
                            sleep 5;
                            printf "\nRemoving Images\n";
                            docker rmi -f $($DOCKER_IMAGES)
                            if [ $? -eq 0 ]; then
                                printf "\n${GREEN}Successfully removed images $RESET\n";
                            else
                                printf "\n${RED}Error removing images $RESET\n";
                                exit;
                            fi
                          else
                            printf "\n${RED}ERROR: THERE ARE NO IMAGES TO REMOVE $RESET\n";
                          fi
                        fi

                        # Remove app images if --appimages or -p flag is given
                        if [ ${REMOVE_APP_IMAGES} = true ]; then
                          echo "Removing app images"
                          # Check to make sure that there are images to remove
                          NUMBER_OF_IMAGES=$($DOCKER_IMAGES_APPS | wc -l)
                          if [ $NUMBER_OF_IMAGES -gt 0 ]; then
                            # Sleep as removing Docker images can be inconvenient if done by accident
                            printf "\n${BLUE}NOW REMOVING IMAGES.\nTHIS IS IRREVERSIBLE SO PAUSING FOR 5 SECONDS.${RESET}\n";
                            sleep 5;
                            printf "\nRemoving Images\n";
                            docker rmi -f $($DOCKER_IMAGES_APPS)
                            if [ $? -eq 0 ]; then
                                printf "\n${GREEN}Successfully removed images $RESET\n";
                            else
                                printf "\n${RED}Error removing images $RESET\n";
                                exit;
                            fi
                          else
                            printf "\n${RED}ERROR: THERE ARE NO APP IMAGES TO REMOVE $RESET\n";
                          fi
                        fi

                        # Remove untagged images is -u or --untagged tag is given
                        if [ ${REMOVE_UNTAGGED} = true ]; then
                          printf "\n${BLUE}REMOVING UNTAGGED IMAGES.\nTHIS MAY HAVE ERRORS AS SOME IMAGES ARE REFERENCED IN OTHER REPOSITORIES.${RESET}\n";
                          docker rmi $(docker images | grep "^<none>" | awk "{print \$3}");
                          if [ $? -eq 0 ]; then
                              printf "\n${GREEN}Successfully removed untagged images $RESET\n";
                          else
                              printf "\n${RED}Error removing untagged images $RESET\n";
                              exit;
                          fi
                        fi

                        '''
                    }
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
