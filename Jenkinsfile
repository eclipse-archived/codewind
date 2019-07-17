#!groovy​

pipeline {
    agent any 
    
	options {
        timestamps()
        skipStagesAfterUnstable()
    }

    stages {
    	stage('Build Docker image') {
            agent {
                label "docker-build"
                      yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: maven
    image: maven:alpine
    command:
    - cat
    tty: true
"""
    			}
            }
            steps {
            	container('maven') {
					sh '''#!/usr/bin/env bash
						echo "Starting build for Eclipse Codewind ..."
						sh 'mvn -version'
						sh './script/build.sh'
					'''
				}
            }
        }
    }
}
