#!/usr/bin/env node

import { prompt } from 'inquirer'
import request from 'axios'
import { Bar } from 'cli-progress'
import { join } from 'path'
import { existsSync, outputFile, readdir } from 'fs-extra'
import JSZip from 'jszip'
import { green, red } from 'ansi-colors'

type InputType = {
    projectType: 'normal' | 'ms-template' 
    projectVersion: 'latest'
}

async function main () {
    const files = await readdir(process.cwd())

    // 如果文件存在, 项目存在，则更新所有的文件信息
    if (files.length > 0 && process.env.TEST !== 'true') {
        console.log(red('E The current directory must be an empty directory'))
        return 
    }

    const result = await prompt<InputType>([{
        type: 'list',
        name: 'projectType',
        message: "What type of project are you trying to create ?",
        choices: [
          'ms-template',
        ],
    }, {
        type: 'list',
        name: 'projectVersion',
        message: "What version are you going to choose ?",
        choices: [
            'latest'
        ]
    }])

    // 下载最新的项目, 进行创建
    if (result.projectType === 'ms-template' && result.projectVersion === 'latest') {
        const fileDownload = new Bar({
            format: 'Working | {bar} | {percentage}% || {value}/{total}',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: true
        });
        
        try {
            const { data, headers } = await request.get('https://codeload.github.com/Web-Lif/ms-template/zip/refs/heads/canary', {
                responseType: "stream"
            })

            const totalLength = Number.parseInt(headers['content-length'])

            fileDownload.start(totalLength, 0, {
                task: 'download'
            }) 

            let bytes: any[] = []
            let bytesLength: number = 0
            data.on('data', (chunk: any) => {
                bytes.push(chunk)
                bytesLength += chunk.length
                fileDownload.update(bytesLength)
            })

            data.on('end', () => {
                fileDownload.stop()
                const buf = Buffer.concat(bytes);
                JSZip.loadAsync(buf).then((zip) => {
                    const projectName = 'ms-template-canary'
                    const files = zip.folder(projectName)?.files || {};
                    Object.keys(files).forEach(key => {
                        const file = files[key]
                        if (!file.dir) {
                            files[key].async("uint8array").then((data) => {
                                const fileDir = key.replace(projectName, '')
                                let path = join(process.cwd(), fileDir)
                                if (process.env.TEST === 'true') {
                                    path = join(process.cwd(), 'tests', fileDir)
                                }
                                outputFile(path, data).then(() => {
                                    console.log(green(`+ ${fileDir}`))
                                }).catch(err => {
                                    console.log(red(`E ${fileDir}\n - ${err.message}`))
                                });
                            })
                        }
                    })
                })
            })
        } catch (error) {
            console.error(error)
        }
    }

}

main().catch((e) => {
    console.log(e)
})