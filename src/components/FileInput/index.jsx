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

const styles = {
  input: {
    position: 'absolute',
    left: '-9999px',
    top: '-9999px',
    visibility: 'hidden',
  },
  button: {
    margin: '20px 0 0 0',
  },
}

const FileInput = ({ disabled, onFileChange }) => {
  const fileInput = useRef()

  const change = () => {
    const reader = new FileReader()

    fileInput.current.files.length && reader.readAsDataURL(fileInput.current.files[0])

    reader.onload = async () => {
      const { result } = reader
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
    fileInput.current.addEventListener('change', change)
    return () => {
      fileInput.current.removeEventListener('change', change)
    }
  }, [change])

  const click = () => {
    if (disabled) {
      onFileChange({})
    } else {
      fileInput.current.click()
    }
  }

  return (
    <section>
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
