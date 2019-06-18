@echo off
REM #*******************************************************************************
REM # Copyright (c) 2019 IBM Corporation and others.
REM # All rights reserved. This program and the accompanying materials
REM # are made available under the terms of the Eclipse Public License v2.0
REM # which accompanies this distribution, and is available at
REM # http://www.eclipse.org/legal/epl-v20.html
REM #
REM # Contributors:
REM #     IBM Corporation - initial API and implementation
REM #*******************************************************************************

SET argCount=0
for %%x in (%*) do SET /A argCount+=1

if %argCount% LSS 4 (
	echo * First argument should be the container name, the second should be the container id, the third should be port mapping, the fourth is the idc docker base directory location
	EXIT /B 1
)

SET CONTAINER_NAME=%1
SET CONTAINER_IMAGE_NAME=%2
SET PORT_MAPPING_PARAMS=%~3
SET IDC_APP_BASE=%4
SET MICROCLIMATE_WS_ORIGIN=%5

SET ARTIFACTS=%~dp0.

SET APPDIR=%cd%

SET LOGSDIR=%ARTIFACTS%/.logs

docker stop %CONTAINER_NAME%
docker rm %CONTAINER_NAME%

docker run -dt --name %CONTAINER_NAME% -v %APPDIR%:/home/default/app -v %LOGSDIR%:/home/default/logs %PORT_MAPPING_PARAMS% %CONTAINER_IMAGE_NAME%
