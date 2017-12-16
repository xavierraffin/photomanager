import React, { Component } from 'react';
import { Grid, Row, Col } from 'react-bootstrap';
const { getIPCPhotoPath } = require('../model/Photo');
import './PhotoExplorer.css';

class PhotoExplorer extends Component {
  constructor(props){
    super(props);
    console.log("PhotoExplorer constructor value = %s", props.value);
    this.state = { storage : props.value };
  }

  createRow(photo, dir) {

    var divStyle = { backgroundImage: 'url(' + dir + getIPCPhotoPath(photo.n) + ')'}
      console.log("style cell= %s : %s",divStyle.backgroundImage, getIPCPhotoPath(photo.n));
    return (
      <Col className="photoBox" style={divStyle} xs={12} sm={6} md={3} lg={2}>
        <div>
        </div>
      </Col>
    )
  }

  render() {
    var cells = [];
    console.log("render PhotoExplorer");
    console.log("value = %s", this.props.value);
    if(this.props.value !== null) {
      console.log("Add cells  0 = %s", this.props.value.chunck[0].w);
      console.log("Add cells = %s", this.props.value.chunck.length);
      for (var i = 0; i < this.props.value.chunck.length; i++) {
        console.log(" cells = %s", this.props.value.chunck[i].w);
        cells[i] = this.createRow(this.props.value.chunck[i], this.props.value.dir);
      }
    }
    return (
      <Grid bsClass="photoGrid">
        <Row bsClass="reset">
          {cells}
        </Row>
      </Grid>
    );
  }
}

export default PhotoExplorer;
