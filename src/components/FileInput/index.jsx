import React, { useEffect, useRef } from 'react'
import { MdAdd as Add } from 'react-icons/md'
import { removeFileExt } from 'utils/general'
import {
  getFriendlyFileType,
  processPDFs,
  processPngsAndJpgs,
  // getEXIF
} from 'utils/image'
import Fab from 'components/elements/Fab'
import styles from './styles'

const FileInput = ({ disabled, onFileChange }) => {
  const fileInput = useRef()

  const change = () => {
    const reader = new FileReader()

    // @ts-ignore
    fileInput.current.files.length && reader.readAsDataURL(fileInput.current.files[0])

    reader.onload = async () => {
      const { result } = reader
      // @ts-ignore
      const file = fileInput.current.files[0]
      const type = getFriendlyFileType(file.type)

      const dataurls =
        type === 'json'
          ? [result]
          : type === 'pdf'
          ? await processPDFs(result)
          : await processPngsAndJpgs(result)

      const obj = {
        name: removeFileExt(file.name),
        dataurls: dataurls,
        type,
      }
      // get exif on unprocessed image or data is lost
      // if (type === 'png' || type === 'jpg') obj.exif = await getEXIF(result)

      onFileChange(obj)
    }
  }

  useEffect(() => {
    // @ts-ignore
    fileInput.current.addEventListener('change', change)
    return () => {
      // @ts-ignore
      fileInput.current.removeEventListener('change', change)
    }
  }, [change])

  const click = () => {
    if (disabled) {
      onFileChange({})
    } else {
      // @ts-ignore
      fileInput.current.click()
    }
  }

  return (
    <section>
      {/* @ts-ignore */}
      <input id="file-input" type="file" ref={fileInput} style={styles.input} />
      <Fab color="primary" onClick={click} style={styles.button}>
        <Add size="2em" />
      </Fab>
    </section>
  )
}

export default FileInput

// future reference:
// <input type="file" accept="image/*" id="capture" capture="camera"/>
